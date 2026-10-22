import { useState } from 'preact/hooks';
import { buildWarmup } from '../../data/warmups';
import { musclesOfParts } from '../../data/stretches';
import { navigate } from '../../hooks/useHashRoute';
import { useRepository } from '../../hooks/useRepository';
import { todayString } from '../../lib/date';
import { minutesLabel, trainedMuscles } from '../../lib/stretchRoute';
import { BODY_PARTS, BODY_PART_LABELS, type BodyPart, type Muscle } from '../../types/models';

/** 熱身播放頁網址 */
export const warmupPlayPath = (muscles: Muscle[]) => `/tools/warmup/play/${muscles.join(',')}`;

/** 練前熱身設定：選今天要練的部位 */
export function WarmupSetup() {
  const repo = useRepository();

  // 預設：進行中的訓練 → 今天已完成的訓練 → 不選
  const [parts, setParts] = useState<BodyPart[]>(() => {
    const draft = repo.getDraft();
    const ids = draft
      ? draft.exercises.map((e) => e.exerciseId)
      : repo
          .getSessions()
          .filter((s) => s.date === todayString())
          .flatMap((s) => s.exercises.map((e) => e.exerciseId));
    const set = new Set(ids.map((id) => repo.getExercise(id)?.bodyPart));
    return BODY_PARTS.filter((p) => set.has(p));
  });

  // 有進行中的訓練時，用實際動作的肌群（更精準）；否則用部位的所有肌群
  const draft = repo.getDraft();
  const draftMuscles = draft
    ? trainedMuscles(
        [{ id: '', date: '', createdAt: 0, updatedAt: 0, exercises: draft.exercises.map((e) => ({ exerciseId: e.exerciseId, sets: [] })) }],
        (id) => repo.getExercise(id),
      ).filter((m) => parts.some((p) => musclesOfParts([p]).includes(m)))
    : [];
  const muscles = draftMuscles.length > 0 ? draftMuscles : musclesOfParts(parts);
  const items = buildWarmup(muscles);
  const seconds = items.reduce((s, x) => s + 5 + (x.perSide ? x.seconds * 2 + 3 : x.seconds), 0);

  const toggle = (p: BodyPart) =>
    setParts((list) => (list.includes(p) ? list.filter((x) => x !== p) : BODY_PARTS.filter((x) => x === p || list.includes(x))));

  return (
    <div class="tool">
      <div class="field">
        <span class="field-label">今天要練哪些部位？</span>
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

      {parts.length === 0 ? (
        <p class="note">選擇今天要練的部位，會自動排出約 5 分鐘的動態熱身。</p>
      ) : (
        <>
          <ol class="stretch-list">
            {items.map((x) => (
              <li key={x.id}>
                <span class="stretch-name">{x.name}</span>
                <span class="muted">
                  {x.detail}，{x.perSide ? `左右各 ${x.seconds} 秒` : `${x.seconds} 秒`}
                </span>
                {x.needs && <span class="stretch-needs">需要：{x.needs}</span>}
              </li>
            ))}
          </ol>
          <button type="button" class="btn btn-primary btn-block btn-two-line" onClick={() => navigate(warmupPlayPath(muscles))}>
            <span>開始熱身</span>
            <small class="on-primary">
              {items.length} 個動作，{minutesLabel(seconds)}
            </small>
          </button>
        </>
      )}

      <p class="note">
        熱身是讓身體「動起來」，不是靜態拉伸。做完動態熱身後，第一個重量動作再用由輕到重的熱身組（在動作卡片的「＋ 熱身組」）把重量帶上去。
      </p>
    </div>
  );
}
