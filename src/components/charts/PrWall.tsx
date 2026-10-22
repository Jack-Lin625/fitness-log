import { EmptyState } from '../EmptyState';
import { useRepository } from '../../hooks/useRepository';
import { addDays, formatDateLabel, todayString } from '../../lib/date';
import { formatNumber } from '../../lib/number';
import { chronological, computeRecords, type ExerciseRecord, type SetRef } from '../../lib/records';

/** 最近幾天內創下的紀錄會標示「新」 */
const NEW_DAYS = 7;

/** 一組的補充說明：次數、RPE、日期 */
function SetDetail({ item: r, showReps = true }: { item: SetRef; showReps?: boolean }) {
  return (
    <span class="pr-detail">
      {showReps && <>× {r.set.reps} 下，</>}
      {r.set.rpe !== undefined && <>RPE {formatNumber(r.set.rpe)}，</>}
      {formatDateLabel(r.date)}
    </span>
  );
}

/** 個人紀錄牆：各動作的最佳重量與最佳估算 1RM */
export function PrWall() {
  const repo = useRepository();
  const sessions = repo.getSessions();
  const records = [...computeRecords(sessions).values()];

  // 每個動作第一次出現的日期：第一次的成績不算「新紀錄」
  const firstDate = new Map<string, string>();
  for (const s of chronological(sessions))
    for (const ex of s.exercises) if (!firstDate.has(ex.exerciseId)) firstDate.set(ex.exerciseId, s.date);

  if (records.length === 0) {
    return <EmptyState title="還沒有個人紀錄" body="完成訓練後，每個動作的最佳表現都會列在這裡。" />;
  }

  const latestDate = (r: ExerciseRecord) =>
    [r.bestWeight?.date, r.bestE1rm?.date, r.bestReps?.date].filter(Boolean).sort().pop() ?? '';
  records.sort((a, b) => latestDate(b).localeCompare(latestDate(a)));
  const newSince = addDays(todayString(), -NEW_DAYS);

  return (
    <ul class="pr-list">
      {records.map((r) => {
        const ex = repo.getExercise(r.exerciseId);
        const latest = latestDate(r);
        const isNew = latest >= newSince && latest > (firstDate.get(r.exerciseId) ?? latest);
        const bodyweight = ex?.isBodyweight ?? false;
        return (
          <li key={r.exerciseId} class="pr-card">
            <header class="pr-head">
              {ex && <span class={`part-dot part-${ex.bodyPart}`} aria-hidden="true" />}
              <h2>{ex?.name ?? '已刪除的動作'}</h2>
              {isNew && <span class="tag tag-pr">近 {NEW_DAYS} 天新紀錄</span>}
            </header>

            <div class="pr-stats">
              {bodyweight ? (
                <>
                  {r.bestReps && (
                    <div class="pr-stat">
                      <span class="pr-label">最多次數</span>
                      <span class="pr-value">
                        <span class="num">{r.bestReps.set.reps}</span> 下
                      </span>
                      <SetDetail item={r.bestReps} showReps={false} />
                    </div>
                  )}
                  {r.bestWeight && r.bestWeight.set.weight > 0 && !ex?.assisted && (
                    <div class="pr-stat">
                      <span class="pr-label">最大負重</span>
                      <span class="pr-value">
                        <span class="num">+{formatNumber(r.bestWeight.set.weight)}</span> kg
                      </span>
                      <SetDetail item={r.bestWeight} />
                    </div>
                  )}
                </>
              ) : (
                <>
                  {r.bestWeight && (
                    <div class="pr-stat">
                      <span class="pr-label">最大重量</span>
                      <span class="pr-value">
                        <span class="num">{formatNumber(r.bestWeight.set.weight)}</span> kg
                      </span>
                      <SetDetail item={r.bestWeight} />
                    </div>
                  )}
                  {r.bestE1rm && (
                    <div class="pr-stat">
                      <span class="pr-label">估算 1RM</span>
                      <span class="pr-value">
                        <span class="num">{formatNumber(Math.round(r.bestE1rm.value * 10) / 10)}</span> kg
                      </span>
                      <span class="pr-detail">
                        {formatNumber(r.bestE1rm.set.weight)}×{r.bestE1rm.set.reps}
                        {r.bestE1rm.set.rpe !== undefined && <>，RPE {formatNumber(r.bestE1rm.set.rpe)}</>}，
                        {formatDateLabel(r.bestE1rm.date)}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
