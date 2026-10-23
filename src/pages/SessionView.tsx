import { deleteSession, editSession, saveAsTemplate, startFromSession } from '../actions/workout';
import { BigStat } from '../components/BigStat';
import { CloudBanner } from '../components/CloudBackup';
import { EquipmentIcon } from '../components/EquipmentIcon';
import { PageHeader } from '../components/PageHeader';
import { navigate } from '../hooks/useHashRoute';
import { useRepository } from '../hooks/useRepository';
import { buildRoutine, routineSeconds } from '../data/stretches';
import { formatDateLabel, todayString } from '../lib/date';
import { minutesLabel, stretchPlayPath, trainedMuscles } from '../lib/stretchRoute';
import { formatSessionDuration, supersetGroups } from '../lib/draft';
import { formatNumber } from '../lib/number';
import { formatWeight, toDisplay, unitLabel } from '../lib/units';
import { describeRecord } from '../lib/recordText';
import { findNewRecords } from '../lib/records';
import { exerciseVolume, formatVolume, sessionVolume } from '../lib/volume';

/** 單次訓練的詳細內容 */
export function SessionView({ id }: { id: string }) {
  const repo = useRepository();
  const session = repo.getSession(id);

  if (!session) {
    return (
      <>
        <PageHeader title="找不到這筆訓練" subtitle="可能已經被刪除。" />
        <a href="#/log" class="btn btn-secondary btn-block btn-link">
          回到紀錄
        </a>
      </>
    );
  }

  const setCount = session.exercises.reduce((n, e) => n + e.sets.length, 0);
  const unit = repo.getWeightUnit();
  const u = unitLabel(unit);
  const groups = supersetGroups(session.exercises);

  // 這次練到的肌群 → 對應的拉伸
  const muscles = trainedMuscles([session], (eid) => repo.getExercise(eid));
  const routine = buildRoutine(muscles, { roller: repo.getSettings().stretchRoller ?? false });
  const stretchButton = routine.length > 0 && (
    <button type="button" class="btn btn-outline btn-block btn-two-line" onClick={() => navigate(stretchPlayPath(muscles))}>
      <span>練完拉伸一下</span>
      <small>
        {routine.length} 個動作，{minutesLabel(routineSeconds(routine, repo.getSettings().stretchSeconds ?? 30))}
      </small>
    </button>
  );
  const isToday = session.date === todayString();
  const records = findNewRecords(session, repo.getSessions(), repo.traitsOf);
  /** 某一組打破的紀錄（可能同時破重量與 1RM） */
  const recordsOf = (exerciseIndex: number, setIndex: number) =>
    records.filter((r) => r.exerciseIndex === exerciseIndex && r.setIndex === setIndex);

  return (
    <>
      <a href="#/log" class="btn-text back-link">
        ‹ 紀錄
      </a>
      <PageHeader
        title={formatDateLabel(session.date)}
        subtitle={`${session.exercises.length} 個動作，共 ${setCount} 組${
          session.durationSec !== undefined ? `，練了 ${formatSessionDuration(session.durationSec)}` : ''
        }`}
      />

      <div class="stat-row stat-row-single">
        <BigStat
          value={formatVolume(toDisplay(sessionVolume(session, repo.isAssisted), unit))}
          unit={u}
          label="這次的總訓練容量（不含熱身組）"
        />
      </div>

      <CloudBanner />

      {/* 今天剛練完的訓練，把拉伸放在最顯眼的位置 */}
      {isToday && stretchButton}

      {session.exercises.map((ex, i) => {
        const exercise = repo.getExercise(ex.exerciseId);
        const bw = exercise?.isBodyweight ?? false;
        const assisted = exercise?.assisted === true;
        let no = 0;
        const group = groups[i];
        return (
          <section key={i} class={group ? 'view-card is-superset' : 'view-card'}>
            {group && (
              <p class="superset-tag">
                超級組 {group.label}
                {group.position + 1}
              </p>
            )}
            <header class="view-head">
              <h2 class="ex-name">
                {exercise && (
                  <span class="eq-tile view-eq" style={{ width: '44px', height: '44px' }}>
                    <EquipmentIcon equipment={exercise.equipment} size={36} labelled />
                  </span>
                )}
                {exercise ? (
                  <a href={`#/charts/exercise/${encodeURIComponent(exercise.id)}`} class="ex-link">
                    {exercise.name}
                  </a>
                ) : (
                  '已刪除的動作'
                )}
              </h2>
              <span class="view-volume">
                <span class="num">{formatVolume(toDisplay(exerciseVolume(ex, repo.isAssisted), unit))}</span> {u}
              </span>
            </header>
            {ex.note && <p class="view-ex-note">{ex.note}</p>}
            <ol class="view-sets">
              {ex.sets.map((s, j) => {
                if (!s.isWarmup) no++;
                const setRecords = recordsOf(i, j);
                return (
                  <li key={j} class={s.isWarmup ? 'is-warmup' : ''}>
                    <span class="view-set-no">{s.isWarmup ? '熱身' : `第 ${no} 組`}</span>
                    <span class="view-set-main">
                      <span class="num">
                        {assisted
                          ? s.weight > 0
                            ? `輔助 ${formatWeight(s.weight, unit)}`
                            : '自體重'
                          : bw
                            ? s.weight > 0
                              ? `+${formatWeight(s.weight, unit)}`
                              : '自體重'
                            : formatWeight(s.weight, unit)}
                      </span>
                      {(!bw || s.weight > 0) && <span class="unit">{u}</span>}
                      <span class="times">×</span>
                      <span class="num">{s.reps}</span>
                      <span class="unit">下</span>
                    </span>
                    <span class="view-set-rpe">{s.rpe !== undefined && <>RPE <span class="num">{formatNumber(s.rpe)}</span></>}</span>
                    {setRecords.length > 0 && (
                      <span class="view-set-pr">
                        <span class="tag tag-pr">PR</span>
                        {setRecords.map((r) => describeRecord(r, unit).replace(/（.*）$/, '')).join('、')}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}

      {session.note && <p class="view-note">{session.note}</p>}

      <div class="action-stack">
        {!isToday && stretchButton}
        <button type="button" class="btn btn-primary btn-block" onClick={() => startFromSession(session)}>
          用這份菜單開始今天的訓練
        </button>
        <button type="button" class="btn btn-secondary btn-block" onClick={() => void saveAsTemplate(session)}>
          存成菜單範本
        </button>
        <button type="button" class="btn btn-secondary btn-block" onClick={() => editSession(session)}>
          修改這筆紀錄
        </button>
        <button
          type="button"
          class="btn btn-danger-text btn-block"
          onClick={async () => {
            if (await deleteSession(session)) navigate('/log');
          }}
        >
          刪除
        </button>
      </div>
    </>
  );
}
