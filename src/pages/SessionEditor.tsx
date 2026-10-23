import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { discardDraft } from '../actions/workout';
import { EmptyState } from '../components/EmptyState';
import { ExerciseCard } from '../components/ExerciseCard';
import { ExercisePicker } from '../components/ExercisePicker';
import { showToast } from '../components/Toast';
import { navigate } from '../hooks/useHashRoute';
import { useRepository } from '../hooks/useRepository';
import { useWakeLock } from '../hooks/useWakeLock';
import { todayString } from '../lib/date';
import { draftToSession, newDraftExercise, supersetGroups } from '../lib/draft';
import { createId } from '../lib/id';
import { errorMessage } from '../lib/errors';
import { describeRecords } from '../lib/recordText';
import { computeRecords, findNewRecords } from '../lib/records';
import { startRest, stopRest } from '../lib/restTimer';
import { trainedMuscles } from '../lib/stretchRoute';
import { warmupPlayPath } from '../components/tools/WarmupSetup';
import { buildWarmup } from '../data/warmups';
import type { DraftExercise, WorkoutDraft } from '../types/models';

/** 自動暫存的延遲（毫秒）：停止輸入後才寫入，避免每打一個字就寫一次 */
const AUTOSAVE_DELAY = 400;

/**
 * 路由入口：沒有進行中的訓練時導回紀錄頁。
 * 實際編輯畫面在 SessionEditor，草稿只在進入時讀取一次。
 */
export function SessionEditorRoute() {
  const repo = useRepository();
  const draft = repo.getDraft();

  useEffect(() => {
    if (!draft) navigate('/log');
  }, [draft === null]);

  return draft ? <SessionEditor key={draft.id} initial={draft} /> : null;
}

function SessionEditor({ initial }: { initial: WorkoutDraft }) {
  const repo = useRepository();
  const [draft, setDraft] = useState<WorkoutDraft>(initial);
  const [picking, setPicking] = useState(false);
  const isEditing = Boolean(draft.editingSessionId);
  /** 這次之前的最佳紀錄（進入畫面時算一次），勾選完成時即時判斷破紀錄 */
  const priorRecords = useMemo(
    () => computeRecords(repo.getSessions().filter((s) => s.id !== initial.editingSessionId)),
    [],
  );

  /** 已完成或已捨棄後設為 true，阻止之後的自動暫存把草稿寫回去 */
  const closedRef = useRef(false);
  const latestRef = useRef(draft);
  latestRef.current = draft;

  useWakeLock(true);

  // 停止輸入一小段時間後自動暫存
  useEffect(() => {
    const id = window.setTimeout(() => {
      if (closedRef.current) return;
      repo.saveDraft(draft).catch((err) => showToast(errorMessage(err)));
    }, AUTOSAVE_DELAY);
    return () => window.clearTimeout(id);
  }, [draft]);

  // 切到背景、關閉分頁、離開此畫面時立即暫存
  useEffect(() => {
    const flush = () => {
      if (!closedRef.current) void repo.saveDraft(latestRef.current).catch(() => undefined);
    };
    const onHidden = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onHidden);
      flush();
    };
  }, []);

  // ───────── 編輯操作 ─────────

  const setExercises = (fn: (list: DraftExercise[]) => DraftExercise[]) =>
    setDraft((d) => ({ ...d, exercises: fn(d.exercises) }));

  const addExercise = (exerciseId: string) => {
    setExercises((list) => [...list, newDraftExercise(exerciseId)]);
    setPicking(false);
    // 等畫面更新後捲到最底，看到剛加入的動作
    window.setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 50);
  };

  const moveExercise = (index: number, delta: -1 | 1) =>
    setExercises((list) => {
      const target = index + delta;
      if (target < 0 || target >= list.length) return list;
      const next = [...list];
      const [item] = next.splice(index, 1);
      if (item) next.splice(target, 0, item);
      return next;
    });

  const removeExercise = (key: string) => setExercises((list) => list.filter((e) => e.key !== key));

  /** 和下一個動作組成超級組；已在超級組裡則退出 */
  const toggleSuperset = (index: number) =>
    setExercises((list) => {
      const current = list[index];
      if (!current) return list;
      if (groups[index]) {
        const { supersetId: _, ...rest } = current;
        return list.map((e, i) => (i === index ? rest : e));
      }
      const next = list[index + 1];
      if (!next) return list;
      const id = next.supersetId ?? createId();
      return list.map((e, i) => (i === index || i === index + 1 ? { ...e, supersetId: id } : e));
    });

  /** 勾選完成一組：超級組要做完最後一個動作才休息；休息時間依動作設定 */
  const onSetCompleted = (index: number) => {
    const group = groups[index];
    if (group && group.position < group.size - 1) {
      stopRest();
      return;
    }
    const s = repo.getSettings();
    const exerciseId = draft.exercises[index]?.exerciseId;
    const seconds = exerciseId ? repo.restSecondsFor(exerciseId) : s.defaultRestSeconds;
    startRest(seconds, { sound: s.timerSound, vibrate: s.timerVibrate });
  };

  // ───────── 完成／捨棄 ─────────

  const finish = async () => {
    const existing = draft.editingSessionId ? repo.getSession(draft.editingSessionId) : undefined;
    const { session, skippedSets } = draftToSession(draft, existing, repo.getWeightUnit());
    if (!session) return showToast('至少要有一組填了次數才能儲存');

    closedRef.current = true;
    try {
      await repo.finishDraft(session);
    } catch (err) {
      closedRef.current = false;
      return showToast(errorMessage(err));
    }
    stopRest();

    // 破紀錄時用簡單的一句話告知（同時附上 RPE，提醒是在什麼強度下做到的）
    const records = findNewRecords(session, repo.getSessions(), repo.traitsOf);
    const recordText = describeRecords(records, (id) => repo.getExercise(id)?.name ?? '', repo.getWeightUnit());
    if (recordText) showToast(recordText, 4500);
    else showToast(skippedSets > 0 ? `已儲存，略過 ${skippedSets} 組沒填次數的紀錄` : '已儲存訓練');
    navigate(`/log/view/${session.id}`);
  };

  const discard = async () => {
    closedRef.current = true; // 對話框開著時暫停自動暫存
    const ok = await discardDraft(latestRef.current);
    if (!ok) {
      closedRef.current = false;
      return;
    }
    navigate(isEditing ? `/log/view/${draft.editingSessionId}` : '/log');
  };

  const usedIds = draft.exercises.map((e) => e.exerciseId);
  const groups = supersetGroups(draft.exercises);
  // 還沒開始做組數時，提供依今天動作排好的動態熱身
  const warmupMuscles = trainedMuscles(
    [{ id: '', date: '', createdAt: 0, updatedAt: 0, exercises: draft.exercises.map((e) => ({ exerciseId: e.exerciseId, sets: [] })) }],
    (id) => repo.getExercise(id),
  );
  const warmupCount = warmupMuscles.length > 0 ? buildWarmup(warmupMuscles).length : 0;
  const doneCount = draft.exercises.reduce((n, e) => n + e.sets.filter((s) => s.completed).length, 0);

  return (
    <>
      <header class="editor-bar">
        <button type="button" class="btn-text" onClick={() => navigate('/log')}>
          ‹ 紀錄
        </button>
        <div class="editor-title">
          {isEditing ? '修改訓練' : '訓練中'}
          {doneCount > 0 && (
            <span class="editor-count">
              已完成 <span class="num">{doneCount}</span> 組
            </span>
          )}
        </div>
        <button type="button" class="btn btn-primary btn-sm" onClick={finish}>
          {isEditing ? '儲存' : '完成'}
        </button>
      </header>

      <label class="field-inline">
        <span>日期</span>
        <input
          type="date"
          class="input input-date"
          value={draft.date}
          max={todayString()}
          onInput={(e) => {
            const v = e.currentTarget.value;
            if (v) setDraft((d) => ({ ...d, date: v }));
          }}
        />
      </label>

      {!isEditing && warmupCount > 0 && draft.exercises.every((e) => e.sets.every((x) => !x.completed)) && (
        <button type="button" class="resume-card warmup-card" onClick={() => navigate(warmupPlayPath(warmupMuscles))}>
          <span class="resume-title">先熱身 5 分鐘</span>
          <span class="resume-sub">依今天的動作排好 {warmupCount} 個動態熱身，做完會回到這裡</span>
        </button>
      )}

      {draft.exercises.length === 0 && (
        <EmptyState title="先加入第一個動作" body="從清單挑選今天要練的動作，也可以新增自己的動作。" />
      )}

      {draft.exercises.map((de, i) => (
        <ExerciseCard
          key={de.key}
          exercise={repo.getExercise(de.exerciseId)}
          value={de}
          index={i}
          total={draft.exercises.length}
          last={repo.getLastPerformance(de.exerciseId, draft.editingSessionId)}
          prior={priorRecords.get(de.exerciseId)}
          superset={groups[i] ?? null}
          onChange={(next) => setExercises((list) => list.map((e) => (e.key === de.key ? next : e)))}
          onRemove={() => removeExercise(de.key)}
          onMove={(delta) => moveExercise(i, delta)}
          onToggleSuperset={() => toggleSuperset(i)}
          onSetCompleted={() => onSetCompleted(i)}
        />
      ))}

      <button type="button" class="btn btn-outline btn-block" onClick={() => setPicking(true)}>
        ＋ 新增動作
      </button>

      <label class="field">
        <span class="field-label">備註</span>
        <textarea
          class="input textarea"
          rows={2}
          maxLength={500}
          placeholder="今天的狀況、感受（選填）"
          value={draft.note}
          onInput={(e) => {
            const note = e.currentTarget.value;
            setDraft((d) => ({ ...d, note }));
          }}
        />
      </label>

      <button type="button" class="btn btn-danger-text btn-block" onClick={discard}>
        {isEditing ? '放棄修改' : '捨棄這次訓練'}
      </button>

      {picking && <ExercisePicker usedIds={usedIds} onPick={addExercise} onClose={() => setPicking(false)} />}
    </>
  );
}
