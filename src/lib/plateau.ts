/**
 * 停滯偵測：常練的動作很久沒有進步
 *
 * 「進步」= 打破最大重量或估算 1RM（自體重量動作：最多次數或最大負重）。
 * 停滯 = 上次進步已經 PLATEAU_WEEKS 週以上，而且之後還練了至少 MIN_SESSIONS_SINCE 次
 * （很久沒練的動作不算停滯），最近 ACTIVE_DAYS 天內還有練。
 * 輔助機器動作不判斷（重量越輕代表越強，規則不同）。
 */
import type { WorkoutSession } from '../types/models';
import { dayNumber } from './movingAverage';
import { chronological, computeRecords } from './records';

export const PLATEAU_WEEKS = 4;
export const MIN_SESSIONS_SINCE = 3;
export const ACTIVE_DAYS = 14;

export interface Plateau {
  exerciseId: string;
  /** 上次進步的日期 */
  lastProgress: string;
  /** 距今幾週沒進步 */
  weeks: number;
  /** 上次進步之後又練了幾次 */
  sessionsSince: number;
}

/**
 * sessions 只需包含 today 之前的紀錄；today 是「現在」的日期（不含）。
 * 依停滯週數由多到少排序。
 */
export function findPlateaus(
  sessions: WorkoutSession[],
  today: string,
  traitsOf: (exerciseId: string) => { bodyweight: boolean; assisted: boolean },
): Plateau[] {
  const past = sessions.filter((s) => s.date < today);
  const todayNum = dayNumber(today);
  // 每個動作練過的日期（有正式組才算）
  const dates = new Map<string, string[]>();
  for (const s of chronological(past)) {
    for (const ex of s.exercises) {
      if (!ex.sets.some((set) => !set.isWarmup)) continue;
      const list = dates.get(ex.exerciseId) ?? [];
      list.push(s.date);
      dates.set(ex.exerciseId, list);
    }
  }

  const result: Plateau[] = [];
  for (const [exerciseId, rec] of computeRecords(past)) {
    const { bodyweight, assisted } = traitsOf(exerciseId);
    if (assisted) continue;
    const progressDates = (
      bodyweight
        ? [rec.bestReps?.date, rec.bestWeight && rec.bestWeight.set.weight > 0 ? rec.bestWeight.date : undefined]
        : [rec.bestE1rm?.date, rec.bestWeight?.date]
    ).filter((d): d is string => d !== undefined);
    if (progressDates.length === 0) continue;
    const lastProgress = progressDates.sort().pop()!;
    const trained = dates.get(exerciseId) ?? [];
    const lastTrained = trained[trained.length - 1];
    if (!lastTrained || todayNum - dayNumber(lastTrained) > ACTIVE_DAYS) continue;
    const weeks = Math.floor((todayNum - dayNumber(lastProgress)) / 7);
    const sessionsSince = trained.filter((d) => d > lastProgress).length;
    if (weeks >= PLATEAU_WEEKS && sessionsSince >= MIN_SESSIONS_SINCE) {
      result.push({ exerciseId, lastProgress, weeks, sessionsSince });
    }
  }
  return result.sort((a, b) => b.weeks - a.weeks || a.exerciseId.localeCompare(b.exerciseId));
}

/** 停滯時可以試的方法 */
export const PLATEAU_TIPS = [
  '減量一週：重量減一成、組數減半，讓身體恢復',
  '換次數範圍：例如從 5 下改成 8–10 下練幾週',
  '換變化動作：例如深蹲改前蹲、臥推改上斜',
  '檢查睡眠和蛋白質，減脂期進步變慢是正常的',
] as const;
