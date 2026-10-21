import { useState } from 'preact/hooks';
import { buildRoutine, routineSeconds } from '../../data/stretches';
import { navigate } from '../../hooks/useHashRoute';
import { useRepository } from '../../hooks/useRepository';
import { todayString } from '../../lib/date';
import { errorMessage } from '../../lib/errors';
import { minutesLabel, stretchPlayPath } from '../../lib/stretchRoute';
import { BODY_PARTS, BODY_PART_LABELS, type BodyPart } from '../../types/models';
import { showToast } from '../Toast';

const HOLD_OPTIONS = [20, 30, 45] as const;

/** 拉伸設定：選部位、每個動作維持幾秒，預覽後開始 */
export function StretchSetup() {
  const repo = useRepository();
  const hold = repo.getSettings().stretchSeconds ?? 30;

  // 預設帶入今天練過的部位
  const [parts, setParts] = useState<BodyPart[]>(() => {
    const today = repo.getSessions().filter((s) => s.date === todayString());
    const trained = new Set(
      today.flatMap((s) => s.exercises.map((e) => repo.getExercise(e.exerciseId)?.bodyPart)),
    );
    return BODY_PARTS.filter((p) => trained.has(p));
  });

  const routine = buildRoutine(parts);
  const toggle = (p: BodyPart) =>
    setParts((list) => (list.includes(p) ? list.filter((x) => x !== p) : BODY_PARTS.filter((x) => x === p || list.includes(x))));

  const setHold = (seconds: number) =>
    repo.updateSettings({ stretchSeconds: seconds }).catch((err) => showToast(errorMessage(err)));

  return (
    <div class="tool">
      <div class="field">
        <span class="field-label">今天練了哪些部位？</span>
        <div class="chips chips-wrap">
          {BODY_PARTS.map((p) => (
            <button
              key={p}
              type="button"
              class={parts.includes(p) ? 'chip is-active' : 'chip'}
              aria-pressed={parts.includes(p)}
              onClick={() => toggle(p)}
            >
              <span class={`part-dot part-${p}`} aria-hidden="true" />
              {BODY_PART_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      <div class="field">
        <span class="field-label">每個動作維持</span>
        <div class="chips">
          {HOLD_OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              class={hold === s ? 'chip is-active' : 'chip'}
              aria-pressed={hold === s}
              onClick={() => setHold(s)}
            >
              <span class="num chip-num">{s}</span>&nbsp;秒
            </button>
          ))}
        </div>
      </div>

      {routine.length === 0 ? (
        <p class="note">選擇部位後，會自動排出適合的拉伸動作。</p>
      ) : (
        <>
          <ol class="stretch-list">
            {routine.map((s) => (
              <li key={s.id}>
                <span class="stretch-name">{s.name}</span>
                <span class="muted">
                  {s.target}，{s.perSide ? `左右各 ${hold} 秒` : `${hold} 秒`}
                </span>
              </li>
            ))}
          </ol>
          <button type="button" class="btn btn-primary btn-block btn-two-line" onClick={() => navigate(stretchPlayPath(parts))}>
            <span>開始拉伸</span>
            <small class="on-primary">
              {routine.length} 個動作，{minutesLabel(routineSeconds(routine, hold))}
            </small>
          </button>
        </>
      )}

      <p class="note">拉到有緊繃感就好，不要拉到痛，也不要彈震。有舊傷或拉伸時出現刺痛，請先停下並詢問專業人員。</p>
    </div>
  );
}
