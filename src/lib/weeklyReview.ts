/**
 * 每週回顧：上週（週一到週日）練了幾次、訓練量、破了哪些紀錄、體重與飲食的變化、哪些部位組數不夠、
 * 哪些動作很久沒進步
 *
 * 只整理紀錄裡已有的資料，沒記錄的項目就不顯示（例如沒量體重就沒有體重那一行）。
 */
import type { BodyMetric, BodyPart, Exercise, FoodEntry, WorkoutSession } from '../types/models';
import { BODY_PARTS } from '../types/models';
import { addDays } from './date';
import { findPlateaus, type Plateau } from './plateau';
import { findNewRecords, type RecordKind } from './records';
import { targetStatus, type SetTarget } from './setTargets';
import { sessionVolume, setsByBodyPart, type IsAssisted } from './volume';

export interface WeekRecord {
  exerciseId: string;
  kind: RecordKind;
  /** 這週最好的成績（kg、估算 1RM kg 或次數） */
  value: number;
  /** 這週之前的紀錄 */
  previous: number;
}

export interface WeeklyReview {
  /** 週一（含） */
  start: string;
  /** 下週一（不含） */
  end: string;
  sessions: number;
  prevSessions: number;
  /** 訓練容量 kg */
  volume: number;
  prevVolume: number;
  records: WeekRecord[];
  /** 平均體重（這週有量才有）；prevAvg 是前一週的平均 */
  weight: { avg: number; prevAvg: number | null } | null;
  /** 有記錄飲食的天數與平均（只算有記錄的那幾天） */
  food: { days: number; avgKcal: number; avgProtein: number | null } | null;
  /** 組數沒達到下限的部位（這週有練才看） */
  lowParts: { part: BodyPart; sets: number; min: number }[];
  /** 到這週結束時，很久沒進步的動作 */
  plateaus: Plateau[];
}

export interface ReviewInput {
  sessions: WorkoutSession[];
  bodyMetrics: BodyMetric[];
  foodEntries: FoodEntry[];
  /** 要回顧的那週的週一 */
  weekStart: string;
  traitsOf: (exerciseId: string) => { bodyweight: boolean; assisted: boolean };
  isAssisted: IsAssisted;
  getExercise: (id: string) => Exercise | undefined;
  targets: Record<BodyPart, SetTarget>;
}

const KIND_PRIORITY: Record<RecordKind, number> = { weight: 0, reps: 1, e1rm: 2 };

const inRange = (date: string, start: string, end: string) => date >= start && date < end;
const average = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

export function weeklyReview(input: ReviewInput): WeeklyReview {
  const { sessions, weekStart: start } = input;
  const end = addDays(start, 7);
  const prevStart = addDays(start, -7);
  const week = sessions.filter((s) => inRange(s.date, start, end));
  const prevWeek = sessions.filter((s) => inRange(s.date, prevStart, start));
  const volume = (list: WorkoutSession[]) => list.reduce((n, s) => n + sessionVolume(s, input.isAssisted), 0);

  // 破紀錄：每個動作只列一項（最大重量 > 最多次數 > 估算 1RM，最大重量最直覺），
  // 取這週最好的成績，previous 是這週第一次破之前的紀錄
  const best = new Map<string, WeekRecord>();
  const ordered = [...week].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
  for (const s of ordered) {
    for (const r of findNewRecords(s, sessions, input.traitsOf)) {
      const prev = best.get(r.exerciseId);
      if (!prev || KIND_PRIORITY[r.kind] < KIND_PRIORITY[prev.kind]) {
        best.set(r.exerciseId, { exerciseId: r.exerciseId, kind: r.kind, value: r.value, previous: r.previous });
      } else if (r.kind === prev.kind && r.value > prev.value) prev.value = r.value;
    }
  }

  const weights = (from: string, to: string) =>
    input.bodyMetrics.filter((m) => inRange(m.date, from, to) && m.weight !== undefined).map((m) => m.weight!);
  const avgWeight = average(weights(start, end));
  const prevAvgWeight = average(weights(prevStart, start));

  const foodByDay = new Map<string, { kcal: number; protein: number; hasProtein: boolean }>();
  for (const f of input.foodEntries) {
    if (!inRange(f.date, start, end)) continue;
    const day = foodByDay.get(f.date) ?? { kcal: 0, protein: 0, hasProtein: false };
    day.kcal += f.kcal;
    if (f.protein !== undefined) [day.protein, day.hasProtein] = [day.protein + f.protein, true];
    foodByDay.set(f.date, day);
  }
  const days = [...foodByDay.values()];
  const proteinDays = days.filter((d) => d.hasProtein);

  const sets = setsByBodyPart(week, input.getExercise);
  const lowParts =
    week.length === 0
      ? []
      : BODY_PARTS.filter((p) => targetStatus(sets[p], input.targets[p]) === 'low').map((p) => ({
          part: p,
          sets: sets[p],
          min: input.targets[p].min,
        }));

  return {
    start,
    end,
    sessions: week.length,
    prevSessions: prevWeek.length,
    volume: volume(week),
    prevVolume: volume(prevWeek),
    records: [...best.values()],
    weight: avgWeight === null ? null : { avg: avgWeight, prevAvg: prevAvgWeight },
    food: days.length
      ? {
          days: days.length,
          avgKcal: average(days.map((d) => d.kcal))!,
          avgProtein: average(proteinDays.map((d) => d.protein)),
        }
      : null,
    lowParts,
    plateaus: findPlateaus(sessions, end, input.traitsOf),
  };
}

/** 這週有沒有東西可以回顧 */
export function hasReview(r: WeeklyReview): boolean {
  return r.sessions > 0 || r.weight !== null || r.food !== null;
}
