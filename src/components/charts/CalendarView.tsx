import { useState } from 'preact/hooks';
import { BigStat } from '../BigStat';
import { EmptyState } from '../EmptyState';
import { useRepository } from '../../hooks/useRepository';
import { currentWeekStreak, longestWeekStreak, monthGrid, trainingDays } from '../../lib/calendar';
import { formatDateLabel, todayString } from '../../lib/date';
import { formatSessionDuration } from '../../lib/draft';
import { BODY_PARTS, BODY_PART_LABELS } from '../../types/models';

const WEEKDAY_HEAD = ['一', '二', '三', '四', '五', '六', '日'];

/** 訓練日曆：一個月一頁，標出哪幾天有練、練了哪些部位 */
export function CalendarView() {
  const repo = useRepository();
  const sessions = repo.getSessions();
  const today = todayString();
  const [y, m] = today.split('-').map(Number) as [number, number];
  const [month, setMonth] = useState({ year: y, month: m - 1 });
  const [selected, setSelected] = useState<string | null>(null);

  if (sessions.length === 0) {
    return <EmptyState title="還沒有訓練紀錄" body="完成訓練後，日曆會標出每天練了哪些部位。" />;
  }

  const days = trainingDays(sessions, (id) => repo.getExercise(id));
  const weeks = monthGrid(month.year, month.month);
  const prefix = `${month.year}-${String(month.month + 1).padStart(2, '0')}-`;
  const monthCount = sessions.filter((s) => s.date.startsWith(prefix)).length;
  const monthDays = [...days.keys()].filter((d) => d.startsWith(prefix)).length;
  const streak = currentWeekStreak(sessions, today);
  const longest = longestWeekStreak(sessions);
  const isThisMonth = month.year === y && month.month === m - 1;
  const earliest = sessions[sessions.length - 1]!.date;
  const canGoBack = `${prefix}01` > earliest;

  const shift = (delta: number) => {
    const d = new Date(month.year, month.month + delta, 1);
    setMonth({ year: d.getFullYear(), month: d.getMonth() });
    setSelected(null);
  };

  const day = selected ? days.get(selected) : undefined;

  return (
    <div class="tool">
      <div class="stat-row">
        <BigStat value={streak} unit="週" label="目前連續訓練" hint={`最長 ${longest} 週`} />
        <BigStat value={monthDays} unit="天" label={`${month.month + 1} 月訓練`} hint={monthCount > monthDays ? `共 ${monthCount} 次` : ''} />
      </div>

      <div class="cal-nav">
        <button type="button" class="btn btn-ghost btn-sm" disabled={!canGoBack} onClick={() => shift(-1)} aria-label="上個月">
          ‹
        </button>
        <h3 class="cal-title">
          {month.year} 年 {month.month + 1} 月
        </h3>
        <button type="button" class="btn btn-ghost btn-sm" disabled={isThisMonth} onClick={() => shift(1)} aria-label="下個月">
          ›
        </button>
      </div>

      <div class="cal" role="grid" aria-label={`${month.year} 年 ${month.month + 1} 月訓練日曆`}>
        <div class="cal-row cal-head" role="row">
          {WEEKDAY_HEAD.map((w) => (
            <span key={w} role="columnheader">
              {w}
            </span>
          ))}
        </div>
        {weeks.map((week) => (
          <div key={week[0]!.date} class="cal-row" role="row">
            {week.map((cell) => {
              const info = days.get(cell.date);
              const n = Number(cell.date.slice(8));
              const cls = [
                'cal-day',
                cell.inMonth ? '' : 'is-out',
                info ? 'is-trained' : '',
                cell.date === today ? 'is-today' : '',
                cell.date === selected ? 'is-selected' : '',
              ]
                .filter(Boolean)
                .join(' ');
              const label = `${formatDateLabel(cell.date)}${info ? `，練了${info.parts.map((p) => BODY_PART_LABELS[p]).join('、')}` : ''}`;
              return (
                <button
                  key={cell.date}
                  type="button"
                  role="gridcell"
                  class={cls}
                  disabled={!info}
                  aria-label={label}
                  aria-pressed={cell.date === selected}
                  onClick={() => setSelected(cell.date === selected ? null : cell.date)}
                >
                  <span class="cal-num num">{n}</span>
                  {info && (
                    <span class="cal-dots" aria-hidden="true">
                      {info.parts.slice(0, 4).map((p) => (
                        <span key={p} class={`part-dot part-${p}`} />
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div class="cal-legend" aria-hidden="true">
        {BODY_PARTS.map((p) => (
          <span key={p}>
            <span class={`part-dot part-${p}`} />
            {BODY_PART_LABELS[p]}
          </span>
        ))}
      </div>

      {day && selected && (
        <section class="section">
          <h2 class="section-title">{formatDateLabel(selected)}</h2>
          <ul class="session-list">
            {day.sessions.map((s) => (
              <li key={s.id}>
                <a href={`#/log/view/${s.id}`} class="session-row">
                  <span class="session-date">{s.exercises.length} 個動作</span>
                  <span class="session-meta">{s.durationSec !== undefined ? formatSessionDuration(s.durationSec) : ''}</span>
                  <span class="session-names">
                    {s.exercises.map((e) => repo.getExercise(e.exerciseId)?.name ?? '已刪除的動作').join('、')}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
      {!selected && <p class="note">點有顏色圓點的日子，可以看那天練了什麼。</p>}
    </div>
  );
}
