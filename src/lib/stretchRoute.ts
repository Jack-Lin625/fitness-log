import { MUSCLE_PART } from '../data/catalog';
import { musclesOfParts } from '../data/stretches';
import { BODY_PARTS, type BodyPart, type Muscle, type WorkoutSession, type Exercise } from '../types/models';

const ALL_MUSCLES = Object.keys(MUSCLE_PART) as Muscle[];

/** 拉伸播放頁的網址，例如 /tools/stretch/play/quads,hamstrings */
export const stretchPlayPath = (muscles: Muscle[]) => `/tools/stretch/play/${muscles.join(',')}`;

/**
 * 從網址解析肌群（保留順序）。
 * 舊版網址用的是部位（legs,core），也能轉成該部位的所有肌群。
 */
export function parseMuscles(param: string | undefined): Muscle[] {
  const tokens = (param ?? '').split(',').filter(Boolean);
  const result: Muscle[] = [];
  for (const t of tokens) {
    if ((ALL_MUSCLES as string[]).includes(t)) result.push(t as Muscle);
    else if ((BODY_PARTS as readonly string[]).includes(t)) result.push(...musclesOfParts([t as BodyPart]));
  }
  return [...new Set(result)];
}

/**
 * 訓練中練到的肌群，依重要性排序：
 * 主要肌群每組算 2 分、次要肌群每組算 1 分，分數高的排前面；
 * 只保留「當過主要肌群」或分數夠高的，避免連前臂這種輕微參與的都排進來。
 */
export function trainedMuscles(
  sessions: WorkoutSession[],
  getExercise: (id: string) => Exercise | undefined,
): Muscle[] {
  const score = new Map<Muscle, number>();
  const primary = new Set<Muscle>();
  for (const s of sessions)
    for (const ex of s.exercises) {
      const e = getExercise(ex.exerciseId);
      if (!e) continue;
      const sets = Math.max(1, ex.sets.filter((x) => !x.isWarmup).length);
      e.primaryMuscles.forEach((m) => {
        primary.add(m);
        score.set(m, (score.get(m) ?? 0) + sets * 2);
      });
      e.secondaryMuscles.forEach((m) => score.set(m, (score.get(m) ?? 0) + sets));
    }
  return [...score.entries()]
    .filter(([m, v]) => primary.has(m) || v >= 6)
    .sort((a, b) => b[1] - a[1])
    .map(([m]) => m);
}

/** 預估時間顯示：「約 6 分鐘」 */
export const minutesLabel = (seconds: number) => `約 ${Math.max(1, Math.round(seconds / 60))} 分鐘`;
