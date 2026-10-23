import { useState } from 'preact/hooks';
import { backupOverdue, daysSinceBackup, downloadBackup } from '../actions/backup';
import { deleteTemplate, resumeDraft, startFromSession, startFromTemplate, startNewWorkout } from '../actions/workout';
import { BigStat } from '../components/BigStat';
import { CloudBanner } from '../components/CloudBackup';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { useRepository } from '../hooks/useRepository';
import { addDays, formatDateLabel, startOfWeek, todayString } from '../lib/date';
import { formatSessionDuration } from '../lib/draft';
import { toDisplay, unitLabel } from '../lib/units';
import { targetStatus } from '../lib/setTargets';
import { formatVolume, sessionVolume, setsByBodyPart, volumeBetween } from '../lib/volume';
import { BODY_PARTS, BODY_PART_LABELS, type BodyPart } from '../types/models';

/** 歷史紀錄一次顯示的筆數（練了幾年後清單會很長） */
const HISTORY_PAGE = 30;

export function LogPage() {
  const repo = useRepository();
  const sessions = repo.getSessions();
  const [historyLimit, setHistoryLimit] = useState(HISTORY_PAGE);
  const draft = repo.getDraft();
  const last = sessions[0];
  // 本週與上週（週一起算）
  const weekStart = startOfWeek();
  const nextWeekStart = addDays(weekStart, 7);
  const lastWeekStart = addDays(weekStart, -7);
  const thisWeekCount = sessions.filter((s) => s.date >= weekStart && s.date < nextWeekStart).length;
  const thisWeekVolume = volumeBetween(sessions, weekStart, nextWeekStart, repo.isAssisted);
  const lastWeekVolume = volumeBetween(sessions, lastWeekStart, weekStart, repo.isAssisted);
  const templates = repo.getTemplates();
  const unit = repo.getWeightUnit();
  const volumeText = (kg: number) => formatVolume(toDisplay(kg, unit));
  const backupDays = daysSinceBackup();
  // 本週各部位組數（近 4 週有練才顯示，避免剛開始用或很久沒練時一排 0）
  const recentlyActive = sessions.some((s) => s.date >= addDays(weekStart, -21));
  const weekSets = setsByBodyPart(
    sessions.filter((s) => s.date >= weekStart && s.date < nextWeekStart),
    (id) => repo.getExercise(id),
  );
  const targets = repo.getSetTargets();

  /** 一次訓練的動作名稱與練到的部位 */
  const describe = (exerciseIds: string[]) => {
    const exercises = exerciseIds.map((id) => repo.getExercise(id));
    const names = exercises.map((e) => e?.name ?? '已刪除的動作');
    const parts = new Set(exercises.map((e) => e?.bodyPart).filter((p): p is BodyPart => !!p));
    return { names, parts: BODY_PARTS.filter((p) => parts.has(p)) };
  };

  return (
    <>
      <PageHeader title="訓練紀錄" subtitle={formatDateLabel(todayString())} />

      <div class="stat-row">
        <BigStat value={thisWeekCount} unit="次" label="本週訓練" />
        <BigStat
          value={volumeText(thisWeekVolume)}
          unit={unitLabel(unit)}
          label="本週訓練容量"
          {...(lastWeekVolume > 0 ? { hint: `上週 ${volumeText(lastWeekVolume)} ${unitLabel(unit)}` } : {})}
        />
      </div>

      {recentlyActive && (
        <a href="#/charts/volume" class="week-sets" aria-label="本週各部位組數，點一下看詳細">
          <span class="week-sets-head">
            <span>本週組數 / 目標下限</span>
            <span>詳細 ›</span>
          </span>
          <span class="week-sets-grid">
            {BODY_PARTS.map((p) => {
              const t = targets[p];
              const n = weekSets[p];
              const status = targetStatus(n, t);
              return (
                <span key={p} class={`week-sets-cell is-${status}`}>
                  <span>{BODY_PART_LABELS[p]}</span>
                  <span>
                    <span class="num">{n}</span>
                    {status !== 'none' && <span class="muted">/{t.min}</span>}
                  </span>
                  {status !== 'none' && (
                    <span class="week-sets-mini" aria-hidden="true">
                      <span style={{ width: `${Math.min(100, (n / t.min) * 100)}%` }} />
                    </span>
                  )}
                </span>
              );
            })}
          </span>
        </a>
      )}

      <CloudBanner />

      {backupOverdue() && (
        <div class="backup-banner" role="status">
          <span>
            {backupDays === null ? '還沒有備份過' : `已經 ${backupDays} 天沒備份`}
            <small>資料只存在這支手機，換手機或手機故障就會遺失</small>
          </span>
          <button type="button" class="btn btn-secondary btn-sm" onClick={() => void downloadBackup()}>
            立即備份
          </button>
        </div>
      )}

      {draft ? (
        <button type="button" class="resume-card" onClick={resumeDraft}>
          <span class="resume-title">{draft.editingSessionId ? '繼續修改紀錄' : '繼續未完成的訓練'}</span>
          <span class="resume-sub">
            {formatDateLabel(draft.date)}，{draft.exercises.length} 個動作
          </span>
        </button>
      ) : (
        <div class="action-stack">
          <button type="button" class="btn btn-primary btn-block" onClick={startNewWorkout}>
            開始今天的訓練
          </button>
          {last && (
            <button type="button" class="btn btn-secondary btn-block btn-two-line" onClick={() => startFromSession(last)}>
              <span>複製上次菜單</span>
              <small>
                {formatDateLabel(last.date)}：{describe(last.exercises.map((e) => e.exerciseId)).names.join('、')}
              </small>
            </button>
          )}
        </div>
      )}

      {!draft && templates.length > 0 && (
        <section class="section">
          <h2 class="section-title">我的菜單範本</h2>
          <ul class="template-list">
            {templates.map((t) => {
              const { names, parts } = describe(t.exercises.map((e) => e.exerciseId));
              return (
                <li key={t.id} class="template-row">
                  <button type="button" class="template-start" onClick={() => startFromTemplate(t)}>
                    <span class="template-name">
                      {t.name}
                      <span class="session-parts" aria-hidden="true">
                        {parts.map((p) => (
                          <span key={p} class={`part-dot part-${p}`} />
                        ))}
                      </span>
                    </span>
                    <span class="template-sub">{names.join('、')}</span>
                  </button>
                  <button
                    type="button"
                    class="icon-btn"
                    aria-label={`刪除範本「${t.name}」`}
                    onClick={() => void deleteTemplate(t)}
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {sessions.length === 0 ? (
        <EmptyState title="還沒有訓練紀錄" body="完成第一次訓練後，紀錄會依日期排列在這裡。" />
      ) : (
        <section class="section">
          <h2 class="section-title section-title-row">
            <span>歷史紀錄（{sessions.length} 次）</span>
            <a href="#/charts/calendar" class="btn-text">
              日曆 ›
            </a>
          </h2>
          <ul class="session-list">
            {sessions.slice(0, historyLimit).map((s) => {
              const { names, parts } = describe(s.exercises.map((e) => e.exerciseId));
              const sets = s.exercises.reduce((n, e) => n + e.sets.length, 0);
              return (
                <li key={s.id}>
                  <a href={`#/log/view/${s.id}`} class="session-row">
                    <span class="session-date">{formatDateLabel(s.date)}</span>
                    <span class="session-meta">
                      {s.durationSec !== undefined && <>{formatSessionDuration(s.durationSec)}・</>}
                      <span class="num">{volumeText(sessionVolume(s, repo.isAssisted))}</span> {unitLabel(unit)}
                    </span>
                    <span class="session-names">
                      {sets} 組：{names.join('、')}
                    </span>
                    <span class="session-parts" aria-hidden="true">
                      {parts.map((p) => (
                        <span key={p} class={`part-dot part-${p}`} />
                      ))}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
          {sessions.length > historyLimit && (
            <button type="button" class="btn btn-ghost btn-block" onClick={() => setHistoryLimit((n) => n + HISTORY_PAGE)}>
              顯示更多（還有 {sessions.length - historyLimit} 次）
            </button>
          )}
        </section>
      )}
    </>
  );
}
