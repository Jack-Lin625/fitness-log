import { useState } from 'preact/hooks';
import type { LastPerformance } from '../data/repository';
import { formatDateLabel } from '../lib/date';
import { emptyDraftSet, formatSetShort } from '../lib/draft';
import { formatNumber, parseNumber, sanitizeDecimalInput, sanitizeIntInput } from '../lib/number';
import { plateText, warmupConfig, warmupLadder } from '../lib/warmupSets';
import { useRepository } from '../hooks/useRepository';
import type { DraftExercise, DraftSet, Exercise } from '../types/models';
import { EQUIPMENT_LABELS, MUSCLE_LABELS } from '../data/catalog';
import { EquipmentIcon } from './EquipmentIcon';
import { ExerciseGuideSheet } from './ExerciseGuideSheet';
import { hasGuide } from '../data/exerciseGuides';
import { showToast } from './Toast';

interface Props {
  exercise: Exercise | undefined;
  value: DraftExercise;
  index: number;
  total: number;
  /** 上次做這個動作的紀錄，用來顯示提示與輸入框的預設值 */
  last: LastPerformance | null;
  onChange: (next: DraftExercise) => void;
  onRemove: () => void;
  onMove: (delta: -1 | 1) => void;
  /** 勾選完成一組時呼叫（用來啟動休息計時器） */
  onSetCompleted: () => void;
}

/** 訓練畫面中的一個動作：組數表格、上次紀錄、加組與刪除 */
export function ExerciseCard(props: Props) {
  const { exercise, value, last } = props;
  const [menuOpen, setMenuOpen] = useState(false);
  const [openSet, setOpenSet] = useState<number | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const isBodyweight = exercise?.isBodyweight ?? false;
  const assisted = exercise?.assisted === true;
  const settings = useRepository().getSettings();
  const warmCfg = exercise && !isBodyweight ? warmupConfig(exercise.equipment, settings.barWeight) : null;
  const hasWarmups = value.sets.some((s) => s.isWarmup);
  /** 槓鈴類才顯示每邊槓片 */
  const showPlates = warmCfg !== null && warmCfg.bar > 0;

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
      if (lastSet) return { weight: formatNumber(lastSet.weight), reps: String(lastSet.reps) };
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
      weight: formatNumber(p.weight),
      reps: String(p.reps),
      rpe: '',
      isWarmup: true,
      completed: false,
    }));
    // 先固定住正式組的重量（避免預設值因為插入熱身組而跑掉）
    const working = value.sets
      .filter((x) => !x.isWarmup)
      .map((x, j) => (j === 0 && !x.weight ? { ...x, weight: formatNumber(work) } : x));
    props.onChange({ ...value, sets: [...warmups, ...working] });
    setMenuOpen(false);
    showToast(`已加入 ${plan.length} 組熱身組`);
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
    updateSet(i, { weight, reps, completed: true });
    // 熱身組之間通常不需要完整休息，只有正式組才自動開始計時
    if (!set.isWarmup) props.onSetCompleted();
  };

  const addSet = () => {
    const prev = value.sets[value.sets.length - 1];
    props.onChange({ ...value, sets: [...value.sets, emptyDraftSet(prev)] });
  };

  const removeSet = (i: number) => {
    props.onChange({ ...value, sets: value.sets.filter((_, j) => j !== i) });
    setOpenSet(null);
  };

  // 正式組的編號（熱身組不佔編號）
  let workingNo = 0;
  const lastWorking = last?.sets.filter((s) => !s.isWarmup) ?? [];

  return (
    <article class="ex-card">
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
        {exercise && hasGuide(exercise.id) && (
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
          <button type="button" class="btn btn-danger-text btn-sm" onClick={props.onRemove}>
            刪除動作
          </button>
        </div>
      )}

      {last && lastWorking.length > 0 && (
        <p class="ex-last">
          上次 {formatDateLabel(last.date)}：
          <span class="num">{lastWorking.map((s) => formatSetShort(s, isBodyweight, assisted)).join('、')}</span>
        </p>
      )}

      <div class="set-grid set-grid-head" aria-hidden="true">
        <span>組</span>
        <span>{assisted ? '輔助公斤' : isBodyweight ? '+公斤' : '公斤'}</span>
        <span>次數</span>
        <span>RPE</span>
        <span>完成</span>
      </div>

      {value.sets.map((set, i) => {
        if (!set.isWarmup) workingNo++;
        const ph = placeholderOf(i);
        return (
          <div key={i}>
            <div class={set.completed ? 'set-grid set-row is-done' : 'set-grid set-row'}>
              <button
                type="button"
                class={set.isWarmup ? 'set-no is-warmup' : 'set-no'}
                aria-label={`第 ${i + 1} 組選項`}
                aria-expanded={openSet === i}
                onClick={() => setOpenSet(openSet === i ? null : i)}
              >
                {set.isWarmup ? '熱' : workingNo}
              </button>
              <input
                class="set-input num"
                inputMode="decimal"
                aria-label={assisted ? '輔助重量（公斤）' : '重量（公斤）'}
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

            {showPlates && (() => {
              const w = parseNumber(set.weight || ph.weight);
              const text = w !== null ? plateText(w, warmCfg!.bar, settings.availablePlates) : null;
              return text ? <p class="set-plates">{text}</p> : null;
            })()}

            {openSet === i && (
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
      {guideOpen && exercise && <ExerciseGuideSheet exercise={exercise} onClose={() => setGuideOpen(false)} />}
    </article>
  );
}
