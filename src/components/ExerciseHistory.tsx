import { useEffect, useState } from 'preact/hooks';
import { BigStat } from './BigStat';
import { EmptyState } from './EmptyState';
import { EquipmentIcon } from './EquipmentIcon';
import { LazyGuideSheet } from './LazyGuideSheet';
import { EQUIPMENT_LABELS, MUSCLE_LABELS } from '../data/catalog';
import { useRepository } from '../hooks/useRepository';
import { formatDateLabel } from '../lib/date';
import { formatSetShort } from '../lib/draft';
import { exerciseHistory } from '../lib/exerciseHistory';
import { formatNumber } from '../lib/number';
import { computeRecords, type RecordKind } from '../lib/records';
import { bestRelativeOf, formatRatio, weighIns } from '../lib/relativeStrength';
import { formatWeight, toDisplay, unitLabel } from '../lib/units';
import { formatVolume } from '../lib/volume';

const RECORD_LABEL: Record<RecordKind, string> = { weight: '最大重量', e1rm: '估算 1RM', reps: '最多次數' };
const PAGE = 20;

/** 某個動作的完整歷史：最佳紀錄、做過幾次、每次的每一組 */
export function ExerciseHistory({ exerciseId, linkSessions = true }: { exerciseId: string; linkSessions?: boolean }) {
  const repo = useRepository();
  const [limit, setLimit] = useState(PAGE);
  const [guideOpen, setGuideOpen] = useState(false);
  const exercise = repo.getExercise(exerciseId);
  const traits = repo.traitsOf(exerciseId);
  const unit = repo.getWeightUnit();
  const u = unitLabel(unit);
  const sessions = repo.getSessions();
  const entries = exerciseHistory(sessions, exerciseId, traits);
  const record = computeRecords(sessions).get(exerciseId);
  // 相對力量最好的一次（估算 1RM ÷ 當時體重）
  const bestRel = traits.bodyweight ? null : bestRelativeOf(sessions, exerciseId, weighIns(repo.getBodyMetrics()));

  return (
    <div class="tool">
      {exercise && (
        <div class="guide-meta">
          <span class="eq-tile" style={{ width: '44px', height: '44px' }}>
            <EquipmentIcon equipment={exercise.equipment} size={36} />
          </span>
          <div>
            <div>{EQUIPMENT_LABELS[exercise.equipment]}</div>
            <div class="muted small-text">主要：{exercise.primaryMuscles.map((m) => MUSCLE_LABELS[m]).join('、')}</div>
          </div>
          {!exercise.isCustom && (
            <button type="button" class="guide-btn" onClick={() => setGuideOpen(true)}>
              教學
            </button>
          )}
        </div>
      )}

      {entries.length === 0 ? (
        <EmptyState title="還沒有做過這個動作" body="完成訓練後，每次的重量、次數和備註都會列在這裡。" />
      ) : (
        <>
          <div class="stat-row">
            {traits.bodyweight ? (
              <BigStat value={record?.bestReps?.set.reps ?? '–'} unit="下" label="最多次數" {...(record?.bestReps ? { hint: formatDateLabel(record.bestReps.date) } : {})} />
            ) : (
              <BigStat
                value={record?.bestE1rm ? formatWeight(Math.round(record.bestE1rm.value * 10) / 10, unit) : record?.bestWeight ? formatWeight(record.bestWeight.set.weight, unit) : '–'}
                unit={u}
                label={record?.bestE1rm ? '最佳估算 1RM' : '最大重量'}
                {...(record?.bestE1rm ? { hint: formatDateLabel(record.bestE1rm.date) } : {})}
              />
            )}
            <BigStat value={entries.length} unit="次" label="做過" hint={`上次 ${formatDateLabel(entries[0]!.date)}`} />
          </div>

          {bestRel && (
            <p class="note">
              相對力量最好的一次：估算 1RM 是體重的 <strong class="num">{formatRatio(bestRel.ratio)}</strong> 倍（體重{' '}
              {formatNumber(bestRel.bodyweight)} kg，{formatDateLabel(bestRel.date)}）
            </p>
          )}

          {!traits.bodyweight && record?.bestE1rm && (
            <a href={`#/charts/trend/${encodeURIComponent(exerciseId)}`} class="btn btn-secondary btn-block btn-link">
              看估算 1RM 趨勢圖
            </a>
          )}

          <ul class="history-list">
            {entries.slice(0, limit).map((e) => {
              const head = (
                <>
                  <span class="history-date">{formatDateLabel(e.date)}</span>
                  <span class="history-meta">
                    {e.workingSets} 組
                    {e.volume > 0 && (
                      <>
                        ・<span class="num">{formatVolume(toDisplay(e.volume, unit))}</span> {u}
                      </>
                    )}
                  </span>
                </>
              );
              return (
                <li key={e.sessionId} class="history-item">
                  {linkSessions ? (
                    <a href={`#/log/view/${e.sessionId}`} class="history-head">
                      {head}
                    </a>
                  ) : (
                    <div class="history-head">{head}</div>
                  )}
                  <p class="history-sets num">
                    {e.sets.map((s, i) => (
                      <span key={i} class={s.isWarmup ? 'history-set is-warmup' : 'history-set'}>
                        {formatSetShort(s, traits.bodyweight, traits.assisted, unit)}
                        {s.rpe !== undefined && <small>@{formatNumber(s.rpe)}</small>}
                      </span>
                    ))}
                  </p>
                  {(e.records.length > 0 || e.note) && (
                    <p class="history-extra">
                      {e.records.length > 0 && (
                        <span class="history-pr">
                          <span class="tag tag-pr">PR</span>
                          {e.records.map((k) => RECORD_LABEL[k]).join('、')}
                        </span>
                      )}
                      {e.note && <span class="muted">備註：{e.note}</span>}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
          {entries.length > limit && (
            <button type="button" class="btn btn-ghost btn-block" onClick={() => setLimit((n) => n + PAGE)}>
              顯示更多（還有 {entries.length - limit} 次）
            </button>
          )}
          <p class="note">灰色的是熱身組；@ 後面是 RPE。PR 標記的是那次打破了當時的紀錄。</p>
        </>
      )}
      {guideOpen && exercise && <LazyGuideSheet exercise={exercise} onClose={() => setGuideOpen(false)} />}
    </div>
  );
}

/** 訓練中用的全螢幕版本（不離開訓練畫面） */
export function ExerciseHistorySheet({ exerciseId, onClose }: { exerciseId: string; onClose: () => void }) {
  const repo = useRepository();
  const name = repo.getExercise(exerciseId)?.name ?? '已刪除的動作';

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <div class="sheet" role="dialog" aria-modal="true" aria-label={`${name}的歷史紀錄`}>
      <header class="sheet-header">
        <button type="button" class="btn-text" onClick={onClose}>
          關閉
        </button>
        <h2>{name}</h2>
        <span class="sheet-header-spacer" />
      </header>
      <div class="sheet-list">
        {/* 訓練中不跳到別的頁面，避免離開訓練畫面 */}
        <ExerciseHistory exerciseId={exerciseId} linkSessions={false} />
      </div>
    </div>
  );
}
