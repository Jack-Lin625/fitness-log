import { useState } from 'preact/hooks';
import { MUSCLE_LABELS, MUSCLE_PART } from '../../data/catalog';
import { buildRoutine, musclesOfParts, POSITION_LABELS, routineSeconds } from '../../data/stretches';
import { navigate } from '../../hooks/useHashRoute';
import { useRepository } from '../../hooks/useRepository';
import { todayString } from '../../lib/date';
import { errorMessage } from '../../lib/errors';
import { minutesLabel, stretchPlayPath, trainedMuscles } from '../../lib/stretchRoute';
import { BODY_PARTS, BODY_PART_LABELS, type Muscle, type Settings } from '../../types/models';
import { showToast } from '../Toast';

const HOLD_OPTIONS = [20, 30, 45] as const;
const ALL_MUSCLES = Object.keys(MUSCLE_PART) as Muscle[];

/** 拉伸設定：選肌群、維持秒數、是否加入滾筒，預覽後開始 */
export function StretchSetup() {
  const repo = useRepository();
  const settings = repo.getSettings();
  const hold = settings.stretchSeconds ?? 30;
  const roller = settings.stretchRoller ?? false;

  // 預設帶入今天練到的肌群（依重要性排序）
  const [muscles, setMuscles] = useState<Muscle[]>(() =>
    trainedMuscles(
      repo.getSessions().filter((s) => s.date === todayString()),
      (id) => repo.getExercise(id),
    ),
  );

  const routine = buildRoutine(muscles, { roller });
  const toggle = (m: Muscle) =>
    setMuscles((list) => (list.includes(m) ? list.filter((x) => x !== m) : [...list, m]));
  const togglePart = (part: (typeof BODY_PARTS)[number]) => {
    const inPart = musclesOfParts([part]);
    const allOn = inPart.every((m) => muscles.includes(m));
    setMuscles((list) => (allOn ? list.filter((m) => !inPart.includes(m)) : [...new Set([...list, ...inPart])]));
  };
  const save = (patch: Partial<Settings>) => repo.updateSettings(patch).catch((err) => showToast(errorMessage(err)));

  return (
    <div class="tool">
      <div class="field">
        <div class="field-row">
          <span class="field-label">要拉伸的肌群</span>
          {muscles.length > 0 && (
            <button type="button" class="btn-text btn-text-sm" onClick={() => setMuscles([])}>
              全部清除
            </button>
          )}
        </div>
        {BODY_PARTS.map((part) => (
          <div key={part} class="muscle-group">
            <button type="button" class="muscle-part" onClick={() => togglePart(part)}>
              <span class={`part-dot part-${part}`} aria-hidden="true" />
              {BODY_PART_LABELS[part]}
            </button>
            <div class="chips chips-wrap chips-sm">
              {ALL_MUSCLES.filter((m) => MUSCLE_PART[m] === part).map((m) => (
                <button
                  key={m}
                  type="button"
                  class={muscles.includes(m) ? 'chip chip-sm is-active' : 'chip chip-sm'}
                  aria-pressed={muscles.includes(m)}
                  onClick={() => toggle(m)}
                >
                  {MUSCLE_LABELS[m]}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div class="field">
        <span class="field-label">每個動作維持</span>
        <div class="chips">
          {HOLD_OPTIONS.map((sec) => (
            <button
              key={sec}
              type="button"
              class={hold === sec ? 'chip is-active' : 'chip'}
              aria-pressed={hold === sec}
              onClick={() => save({ stretchSeconds: sec })}
            >
              <span class="num chip-num">{sec}</span>&nbsp;秒
            </button>
          ))}
        </div>
      </div>

      <label class="switch-row settings-card">
        <span>
          加入滾筒放鬆
          <small class="muted">健身房有滾筒的話，先滾一滾再拉伸</small>
        </span>
        <input
          type="checkbox"
          role="switch"
          class="switch"
          checked={roller}
          onChange={(e) => save({ stretchRoller: e.currentTarget.checked })}
        />
      </label>

      {routine.length === 0 ? (
        <p class="note">選擇肌群後，會自動排出適合的拉伸動作。今天有記錄訓練的話，會自動帶入練到的肌群。</p>
      ) : (
        <>
          <ol class="stretch-list">
            {routine.map((st) => (
              <li key={st.id}>
                <span class="stretch-name">
                  {st.name}
                  <span class="tag">{st.roller ? '滾筒' : POSITION_LABELS[st.position]}</span>
                </span>
                <span class="muted">
                  {st.detail}，{st.perSide ? `左右各 ${hold} 秒` : `${hold} 秒`}
                </span>
                {st.needs && <span class="stretch-needs">需要：{st.needs}</span>}
              </li>
            ))}
          </ol>
          <button
            type="button"
            class="btn btn-primary btn-block btn-two-line"
            onClick={() => navigate(stretchPlayPath(muscles))}
          >
            <span>開始拉伸</span>
            <small class="on-primary">
              {routine.length} 個動作，{minutesLabel(routineSeconds(routine, hold))}
            </small>
          </button>
        </>
      )}

      <p class="note">
        拉到有緊繃感就好，不要拉到痛，也不要彈震。維持時自然呼吸，吐氣時可以再放鬆一點。有舊傷或出現刺痛、麻感，請立刻停止並詢問專業人員。
      </p>
    </div>
  );
}
