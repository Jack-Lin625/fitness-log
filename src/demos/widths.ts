/**
 * 3D 示範的左右寬度（離身體中線的距離）：側面示範看不出握距、站距，這裡逐個動作指定。
 * 沒列的動作依器材推測（見 scene3d.ts 的 widthsOf）。
 */
import type { Demo } from './types';

export const WIDTHS: Record<string, NonNullable<Demo['width']>> = {
  // 胸
  'bench-press': { grip: 26 },
  'incline-bench-press': { grip: 26 },
  'decline-bench-press': { grip: 26 },
  'smith-bench-press': { grip: 26 },
  'smith-incline-press': { grip: 26 },
  'close-grip-bench': { grip: 12 },
  'push-up': { grip: 21 },
  'incline-push-up': { grip: 21 },
  'diamond-push-up': { grip: 4 },
  dips: { grip: 21, parallelBars: true },
  'assisted-dip': { grip: 21, parallelBars: true },
  // 背
  deadlift: { grip: 20, stance: 11 },
  'rack-pull': { grip: 20, stance: 11 },
  'romanian-deadlift': { grip: 20 },
  'stiff-leg-deadlift': { grip: 20 },
  'trap-bar-deadlift': { grip: 22, stance: 11 },
  'sumo-deadlift': { grip: 13, stance: 26 },
  'barbell-row': { grip: 22 },
  'pendlay-row': { grip: 22 },
  'barbell-shrug': { grip: 20 },
  'pull-up': { grip: 28 },
  'assisted-pull-up': { grip: 28 },
  'chin-up': { grip: 14 },
  'neutral-pull-up': { grip: 12 },
  'lat-pulldown': { grip: 28 },
  'close-grip-pulldown': { grip: 5 },
  'reverse-grip-pulldown': { grip: 14 },
  'straight-arm-pulldown': { grip: 18 },
  'inverted-row': { grip: 24 },
  // 腿
  squat: { grip: 26, stance: 16 },
  'front-squat': { grip: 17, stance: 15 },
  'smith-squat': { grip: 26, stance: 15 },
  'goblet-squat': { stance: 16 },
  'sumo-squat': { stance: 26 },
  'hack-squat': { stance: 14 },
  'leg-press': { stance: 14 },
  'good-morning': { grip: 26, stance: 13 },
  'hip-thrust': { grip: 26, stance: 14 },
  'glute-bridge': { stance: 13 },
  // 肩
  'overhead-press': { grip: 20 },
  'push-press': { grip: 20 },
  'smith-shoulder-press': { grip: 22 },
  'upright-row': { grip: 10 },
  'face-pull': { grip: 6 },
  // 手臂
  'barbell-curl': { grip: 16 },
  'reverse-curl': { grip: 16 },
  'ez-curl': { grip: 13 },
  'preacher-curl': { grip: 14 },
  'cable-curl': { grip: 12 },
  'skull-crusher': { grip: 11 },
  'triceps-pushdown': { grip: 10 },
  'rope-pushdown': { grip: 5 },
  // 核心
  plank: { grip: 10 },
};
