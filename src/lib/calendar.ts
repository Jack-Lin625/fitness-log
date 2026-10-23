/**
 * 訓練日曆的計算：月曆格子、每天練了哪些部位、連續訓練週數
 * 一週從週一開始（和「本週訓練」一致）。
 */
import { BODY_PARTS, type BodyPart, type Exercise, type WorkoutSession } from '../types/models';
import { addDays, startOfWeek } from './date';

export interface CalendarCell {
  date: string;
  /** 是不是這個月的日期（月曆前後補上的上下個月日期為 false） */
  inMonth: boolean;
}

/** 某個月的月曆：每列 7 天、週一開始；month 為 0–11 */
export function monthGrid(year: number, month: number): CalendarCell[][] {
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
  let day = startOfWeek(new Date(year, month, 1));
  const weeks: CalendarCell[][] = [];
  // 從第一天所在的週一開始，排到這個月結束的那一週
  while (weeks.length === 0 || day.startsWith(prefix)) {
    const week: CalendarCell[] = [];
    for (let i = 0; i < 7; i++) {
      week.push({ date: day, inMonth: day.startsWith(prefix) });
      day = addDays(day, 1);
    }
    weeks.push(week);
  }
  return weeks;
}

export interface TrainingDay {
  /** 這天的訓練（依傳入的順序） */
  sessions: WorkoutSession[];
  /** 練到的部位（依固定順序） */
  parts: BodyPart[];
}

/** 每天的訓練與部位 */
export function trainingDays(
  sessions: WorkoutSession[],
  getExercise: (id: string) => Exercise | undefined,
): Map<string, TrainingDay> {
  const days = new Map<string, TrainingDay>();
  for (const s of sessions) {
    const day = days.get(s.date) ?? { sessions: [], parts: [] };
    day.sessions.push(s);
    const parts = new Set(day.parts);
    for (const ex of s.exercises) {
      const part = getExercise(ex.exerciseId)?.bodyPart;
      if (part) parts.add(part);
    }
    day.parts = BODY_PARTS.filter((p) => parts.has(p));
    days.set(s.date, day);
  }
  return days;
}

/** 有訓練的週（週一的日期） */
function trainedWeeks(sessions: WorkoutSession[]): Set<string> {
  return new Set(sessions.map((s) => startOfWeek(parseDate(s.date))));
}

const parseDate = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
};

/**
 * 目前連續幾週都有訓練。
 * 本週還沒練不算中斷（週還沒過完），從上週開始往回算。
 */
export function currentWeekStreak(sessions: WorkoutSession[], today: string): number {
  const weeks = trainedWeeks(sessions);
  let week = startOfWeek(parseDate(today));
  if (!weeks.has(week)) week = addDays(week, -7);
  let streak = 0;
  while (weeks.has(week)) {
    streak++;
    week = addDays(week, -7);
  }
  return streak;
}

/** 最長連續訓練週數 */
export function longestWeekStreak(sessions: WorkoutSession[]): number {
  const weeks = [...trainedWeeks(sessions)].sort();
  let best = 0;
  let run = 0;
  let prev = '';
  for (const w of weeks) {
    run = prev && addDays(prev, 7) === w ? run + 1 : 1;
    best = Math.max(best, run);
    prev = w;
  }
  return best;
}
