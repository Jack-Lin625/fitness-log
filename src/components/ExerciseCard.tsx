import { useState } from 'preact/hooks';
import type { LastPerformance } from '../data/repository';
import { formatDateLabel } from '../lib/date';
import { emptyDraftSet, formatSetShort, type SupersetInfo } from '../lib/draft';
import { formatDuration, formatNumber, parseNumber, sanitizeDecimalInput, sanitizeIntInput } from '../lib/number';
import { suggestNext, type Suggestion } from '../lib/progression';
import { setRecordKinds, type ExerciseRecord, type RecordKind } from '../lib/records';
import { formatWeight, fromDisplay, LB_PLATES, unitLabel, unitName } from '../lib/units';
import { plateText, warmupConfigFor, warmupLadder } from '../lib/warmupSets';
import { useRepository } from '../hooks/useRepository';
import type { DraftExercise, DraftSet, Exercise, WeightUnit, WorkoutSet } from '../types/models';
import { EQUIPMENT_LABELS, MUSCLE_LABELS } from '../data/catalog';
import { EquipmentIcon } from './EquipmentIcon';
import { ExerciseHistorySheet } from './ExerciseHistory';
import { LazyGuideSheet } from './LazyGuideSheet';
import { showToast } from './Toast';

/** 休息時間的選項（秒） */
const REST_OPTIONS = [30, 45, 60, 90, 120, 150, 180, 240, 300];

const RECORD_LABEL: Record<RecordKind, string> = { weight: '最大重量', e1rm: '估算 1RM', reps: '最多次數' };

interface Props {
  exercise: Exercise | undefined;
  value: DraftExercise;
  index: number;
  total: number;
  /** 上次做這個動作的紀錄，用來顯示提示與輸入框的預設值 */
  last: LastPerformance | null;
  /** 這次之前的最佳紀錄，用來在勾選完成時即時提示破紀錄 */
  prior: ExerciseRecord | undefined;
  /** 所屬的超級組（不在超級組為 null） */
  superset: SupersetInfo | null;
  onChange: (next: DraftExercise) => void;
  onRemove: () => void;
  onMove: (delta: -1 | 1) => void;
  /** 和下一個動作組成超級組／取消超級組 */
  onToggleSuperset: () => void;
  /** 勾選完成一組正式組時呼叫（用來啟動休息計時器） */
  onSetCompleted: () => void;
}

/** 草稿的一組 → 公斤制的 WorkoutSet（判斷破紀錄用） */
function toWorkoutSet(set: DraftSet, unit: WeightUnit): WorkoutSet | null {
  const reps = parseNumber(set.reps);
  if (reps === null || reps <= 0) return null;
  return { weight: fromDisplay(parseNumber(set.weight) ?? 0, unit), reps: Math.round(reps), isWarmup: set.isWarmup };
}

/** 建議的文字，例如「82.5 kg × 5」「每組 9 下」 */
function suggestionText(s: Suggestion, unit: WeightUnit, assisted: boolean): string {
  const w = `${formatWeight(s.weight, unit)} ${unitLabel(unit)}`;
  switch (s.kind) {
    case 'increase':
      return `加重到 ${w} × ${s.reps}`;
    case 'lessAssist':
      return `輔助減到 ${w} × ${s.reps}`;
    case 'reps':
      return `每組做到 ${s.reps} 下`;
    case 'hold':
      if (s.weight <= 0) return `維持每組 ${s.reps} 下，把每組都做滿`;
      return `${assisted ? '輔助' : ''}維持 ${w}，目標每組 ${s.reps} 下`;
  }
}

/** 訓練畫面中的一個動作：組數表格、上次紀錄、加組與刪除 */
export function ExerciseCard(props: Props) {
  const { exercise, value, last, prior, superset } = props;
  const [menuOpen, setMenuOpen] = useState(false);
  const [openSet, setOpenSet] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const repo = useRepository();
  const isBodyweight = exercise?.isBodyweight ?? false;
  const assisted = exercise?.assisted === true;
  const traits = { bodyweight: isBodyweight, assisted };
  const settings = repo.getSettings();
  const unit = repo.getWeightUnit();
  const unitText = unitLabel(unit);
  const warmCfg = exercise && !isBodyweight ? warmupConfigFor(exercise.equipment, settings.barWeight, unit) : null;
  const hasWarmups = value.sets.some((s) => s.isWarmup);
  /** 槓鈴類才顯示每邊槓片 */
  const showPlates = warmCfg !== null && warmCfg.bar > 0;
  const barForPlates = unit === 'lb' ? (warmCfg?.bar ?? 0) : settings.barWeight;
  const platesForUnit = unit === 'lb' ? LB_PLATES : settings.availablePlates;
  const restSeconds = exercise ? repo.restSecondsFor(exercise.id) : settings.defaultRestSeconds;
  const hasCustomRest = exercise ? settings.restByExercise?.[exercise.id] !== undefined : false;

  /** 一次能加的重量（公斤）：依器材與單位 */
  const stepKg = fromDisplay(warmCfg?.step ?? (unit === 'lb' ? (assisted ? 10 : 5) : assisted ? 5 : 2.5), unit);
  const suggestion = last ? suggestNext(last.sets, traits, stepKg) : null;

  const updateSet = (i: number, patch: Partial<DraftSet>) =>
    props.onChange({ ...value, sets: value.sets.map((s, j) => (j === i ? { ...s, ...patch } : s)) });

  /**
   * 輸入框的灰色預設值：優先用上次「同類型、同順序」的那一組
   * （第 2 個正式組對應上次的第 2 個正式組，熱身組對應熱身組），其次用本次上一組。
   */
  const placeholderOf = (i: number): { weight: string; reps: string } => {
    const set = value.sets[i];
    if (set) {
      const ordinal = value.sets.slice(0, i).filter((x) => x.isWarmup === set.isWarmup).length;
      const lastSet = last?.sets.filter((x) => (x.isWarmup ?? false) === set.isWarmup)[ordinal];
      if (lastSet) return { weight: formatWeight(lastSet.weight, unit), reps: String(lastSet.reps) };
    }
    const prev = value.sets[i - 1];
    return { weight: prev?.weight ?? '', reps: prev?.reps ?? '' };
  };

  /** 依第一個正式組的重量，在前面插入熱身組階梯 */
  const addWarmupSets = () => {
    if (!warmCfg) return;
    const firstWork = value.sets.findIndex((x) => !x.isWarmup);
    const ref = firstWork >= 0 ? value.sets[firstWork] : undefined;
    const work = parseNumber(ref?.weight || (firstWork >= 0 ? placeholderOf(firstWork).weight : '')) ?? 0;
    if (work <= 0) return showToast('先填正式組的重量，才能算出熱身組');
    const plan = warmupLadder(work, warmCfg.step, warmCfg.bar);
    if (plan.length === 0) return showToast('這個重量不需要熱身組');
    const warmups: DraftSet[] = plan.map((p) => ({
      ...emptyDraftSet(),
      weight: formatNumber(p.weight),
      reps: String(p.reps),
      isWarmup: true,
    }));
    // 先固定住正式組的重量（避免預設值因為插入熱身組而跑掉）
    const working = value.sets
      .filter((x) => !x.isWarmup)
      .map((x, j) => (j === 0 && !x.weight ? { ...x, weight: formatNumber(work) } : x));
    props.onChange({ ...value, sets: [...warmups, ...working] });
    setMenuOpen(false);
    showToast(`已加入 ${plan.length} 組熱身組`);
  };

  /** 把建議的重量、次數填進還沒完成的正式組（使用者按了才填，會取代複製來的數字） */
  const applySuggestion = () => {
    if (!suggestion) return;
    const weight = suggestion.weight > 0 || !isBodyweight ? formatWeight(suggestion.weight, unit) : '';
    const reps = String(suggestion.reps);
    const sets = value.sets.map((s) => (s.isWarmup || s.completed ? s : { ...s, weight, reps }));
    props.onChange({ ...value, sets });
  };

  /** 這組（已完成）打破的紀錄 */
  const recordsOf = (set: DraftSet): RecordKind[] => {
    if (!set.completed) return [];
    const ws = toWorkoutSet(set, unit);
    return ws ? setRecordKinds(ws, prior, traits) : [];
  };

  /** 勾選完成：空白欄位自動填入預設值，並開始休息計時 */
  const toggleDone = (i: number) => {
    const set = value.sets[i];
    if (!set) return;
    if (set.completed) return updateSet(i, { completed: false });

    const ph = placeholderOf(i);
    const weight = set.weight || ph.weight || (isBodyweight ? '0' : '');
    const reps = set.reps || ph.reps;
    if (!reps) return showToast('先填這組的次數');
    const done = { ...set, weight, reps, completed: true };
    updateSet(i, { weight, reps, completed: true });
    // 熱身組之間通常不需要完整休息，只有正式組才自動開始計時
    if (!set.isWarmup) props.onSetCompleted();

    const kinds = recordsOf(done);
    if (kinds.length > 0) showToast(`新紀錄！${exercise?.name ?? ''} ${kinds.map((k) => RECORD_LABEL[k]).join('、')}`, 3500);
  };

  const addSet = () => {
    const prev = value.sets[value.sets.length - 1];
    props.onChange({ ...value, sets: [...value.sets, emptyDraftSet(prev)] });
  };

  const removeSet = (i: number) => {
    props.onChange({ ...value, sets: value.sets.filter((_, j) => j !== i) });
    setOpenSet(null);
  };

  const changeRest = (raw: string) => {
    if (!exercise) return;
    const seconds = raw === '' ? null : Number(raw);
    repo.setExerciseRest(exercise.id, seconds).catch(() => showToast('休息時間沒有存成功'));
  };

  // 正式組的編號（熱身組不佔編號）
  let workingNo = 0;
  const lastWorking = last?.sets.filter((s) => !s.isWarmup) ?? [];
  const showNote = noteOpen || Boolean(value.note);
  const cardClass = ['ex-card', superset ? 'is-superset' : '', superset && superset.position > 0 ? 'is-superset-next' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <article class={cardClass}>
      {superset && (
        <p class="superset-tag">
          超級組 {superset.label}
          {superset.position + 1}
          <span class="muted">
            {superset.position < superset.size - 1 ? '：做完一組接著做下一個動作' : '：這組做完再休息'}
          </span>
        </p>
      )}
      <header class="ex-head">
        {exercise && (
          <span class="eq-tile" style={{ width: '52px', height: '52px' }}>
            <EquipmentIcon equipment={exercise.equipment} size={42} labelled />
          </span>
        )}
        <div class="ex-title">
          <h2 class="ex-name">{exercise?.name ?? '已刪除的動作'}</h2>
          {exercise && (
            <span class="ex-sub">
              <span class={`part-dot part-${exercise.bodyPart}`} aria-hidden="true" />
              {EQUIPMENT_LABELS[exercise.equipment]}｜{exercise.primaryMuscles.map((m) => MUSCLE_LABELS[m]).join('、')}
            </span>
          )}
        </div>
        {/* 每個內建動作都有教學（測試會檢查），自訂動作沒有 */}
        {exercise && !exercise.isCustom && (
          <button type="button" class="guide-btn" onClick={() => setGuideOpen(true)}>
            教學
          </button>
        )}
        <button
          type="button"
          class="icon-btn"
          aria-label="動作選項"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          ⋯
        </button>
      </header>

      {menuOpen && (
        <div class="ex-menu">
          <button type="button" class="btn btn-secondary btn-sm" disabled={props.index === 0} onClick={() => props.onMove(-1)}>
            上移
          </button>
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            disabled={props.index === props.total - 1}
            onClick={() => props.onMove(1)}
          >
            下移
          </button>
          {warmCfg && (
            <button type="button" class="btn btn-secondary btn-sm" onClick={addWarmupSets}>
              {hasWarmups ? '重新計算熱身組' : '加入熱身組'}
            </button>
          )}
          {exercise && last && (
            <button
              type="button"
              class="btn btn-secondary btn-sm"
              onClick={() => {
                setHistoryOpen(true);
                setMenuOpen(false);
              }}
            >
              歷史紀錄
            </button>
          )}
          {!showNote && (
            <button
              type="button"
              class="btn btn-secondary btn-sm"
              onClick={() => {
                setNoteOpen(true);
                setMenuOpen(false);
              }}
            >
              加備註
            </button>
          )}
          {(superset || props.index < props.total - 1) && (
            <button
              type="button"
              class="btn btn-secondary btn-sm"
              onClick={() => {
                props.onToggleSuperset();
                setMenuOpen(false);
              }}
            >
              {superset ? '取消超級組' : '和下一個動作做超級組'}
            </button>
          )}
          {exercise && (
            <label class="ex-menu-rest">
              <span>休息</span>
              <select
                class="input select select-sm"
                value={hasCustomRest ? String(restSeconds) : ''}
                onChange={(e) => changeRest(e.currentTarget.value)}
              >
                <option value="">預設 {formatDuration(settings.defaultRestSeconds)}</option>
                {REST_OPTIONS.map((sec) => (
                  <option key={sec} value={String(sec)}>
                    {formatDuration(sec)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button type="button" class="btn btn-danger-text btn-sm" onClick={props.onRemove}>
            刪除動作
          </button>
        </div>
      )}

      {showNote && (
        <label class="ex-note">
          <span class="visually-hidden">動作備註</span>
          <input
            class="input input-sm"
            maxLength={100}
            placeholder={last?.note ? `上次：${last.note}` : '例如：座椅第 4 格、握距比肩寬'}
            value={value.note ?? ''}
            onInput={(e) => props.onChange({ ...value, note: e.currentTarget.value })}
          />
        </label>
      )}

      {last && lastWorking.length > 0 && (
        <p class="ex-last">
          上次 {formatDateLabel(last.date)}：
          <span class="num">{lastWorking.map((s) => formatSetShort(s, isBodyweight, assisted, unit)).join('、')}</span>
          {hasCustomRest && <span class="muted">｜休息 {formatDuration(restSeconds)}</span>}
          <button type="button" class="btn-text ex-last-more" onClick={() => setHistoryOpen(true)}>
            全部 ›
          </button>
        </p>
      )}
      {!showNote && last?.note && <p class="ex-last ex-last-note">備註：{last.note}</p>}

      {suggestion && value.sets.some((s) => !s.isWarmup && !s.completed) && (
        <div class="ex-suggest">
          <span>
            <span class="ex-suggest-label">建議</span>
            {suggestionText(suggestion, unit, assisted)}
          </span>
          <button type="button" class="btn btn-ghost btn-sm" onClick={applySuggestion}>
            套用
          </button>
        </div>
      )}

      <div class="set-grid set-grid-head" aria-hidden="true">
        <span>組</span>
        <span>{assisted ? `輔助${unitText}` : isBodyweight ? `+${unitText}` : unitText}</span>
        <span>次數</span>
        <span>RPE</span>
        <span>完成</span>
      </div>

      {value.sets.map((set, i) => {
        if (!set.isWarmup) workingNo++;
        const ph = placeholderOf(i);
        const records = recordsOf(set);
        return (
          <div key={set.key}>
            <div class={set.completed ? 'set-grid set-row is-done' : 'set-grid set-row'}>
              <button
                type="button"
                class={set.isWarmup ? 'set-no is-warmup' : 'set-no'}
                aria-label={`第 ${i + 1} 組選項`}
                aria-expanded={openSet === set.key}
                onClick={() => setOpenSet(openSet === set.key ? null : set.key)}
              >
                {set.isWarmup ? '熱' : workingNo}
              </button>
              <input
                class="set-input num"
                inputMode="decimal"
                aria-label={assisted ? `輔助重量（${unitName(unit)}）` : `重量（${unitName(unit)}）`}
                placeholder={ph.weight || (isBodyweight ? '0' : '')}
                value={set.weight}
                onInput={(e) => updateSet(i, { weight: sanitizeDecimalInput(e.currentTarget.value) })}
              />
              <input
                class="set-input num"
                inputMode="numeric"
                aria-label="次數"
                placeholder={ph.reps}
                value={set.reps}
                onInput={(e) => updateSet(i, { reps: sanitizeIntInput(e.currentTarget.value) })}
              />
              <input
                class="set-input set-input-rpe num"
                inputMode="decimal"
                aria-label="RPE（選填）"
                placeholder="–"
                value={set.rpe}
                onInput={(e) => updateSet(i, { rpe: sanitizeDecimalInput(e.currentTarget.value).slice(0, 4) })}
              />
              <button
                type="button"
                class="set-check"
                role="checkbox"
                aria-checked={set.completed}
                aria-label="完成這組"
                onClick={() => toggleDone(i)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              </button>
            </div>

            {records.length > 0 && (
              <p class="set-pr">
                <span class="tag tag-pr">PR</span>
                {records.map((k) => RECORD_LABEL[k]).join('、')}
              </p>
            )}

            {showPlates && (() => {
              const w = parseNumber(set.weight || ph.weight);
              const text = w !== null ? plateText(w, barForPlates, platesForUnit) : null;
              return text ? <p class="set-plates">{text}</p> : null;
            })()}

            {openSet === set.key && (
              <div class="set-menu">
                <button
                  type="button"
                  class="btn btn-secondary btn-sm"
                  onClick={() => {
                    updateSet(i, { isWarmup: !set.isWarmup });
                    setOpenSet(null);
                  }}
                >
                  {set.isWarmup ? '改為正式組' : '標記為熱身組'}
                </button>
                <button type="button" class="btn btn-danger-text btn-sm" onClick={() => removeSet(i)}>
                  刪除這組
                </button>
              </div>
            )}
          </div>
        );
      })}

      <div class={warmCfg && !hasWarmups ? 'card-actions two' : 'card-actions'}>
        <button type="button" class="btn btn-ghost" onClick={addSet}>
          ＋ 加一組
        </button>
        {warmCfg && !hasWarmups && (
          <button type="button" class="btn btn-ghost" onClick={addWarmupSets}>
            ＋ 熱身組
          </button>
        )}
      </div>
      {guideOpen && exercise && <LazyGuideSheet exercise={exercise} onClose={() => setGuideOpen(false)} />}
      {historyOpen && exercise && <ExerciseHistorySheet exerciseId={exercise.id} onClose={() => setHistoryOpen(false)} />}
    </article>
  );
}
