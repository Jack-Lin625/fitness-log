import { benchDemo, deadliftDemo, hipThrustDemo, pressDemo, rdlDemo, rowDemo } from './barbell';
import { ARM_DEMOS } from './arms';
import { BACK_DEMOS } from './back';
import { CHEST_DEMOS } from './chest';
import { CORE_DEMOS } from './core';
import { LEGS_DEMOS } from './legs';
import { SHOULDER_DEMOS } from './shoulders';
import { squatDemo } from './squat';
import type { Demo } from './types';
import { WIDTHS } from './widths';

/** 有假人示範的動作 */
const BASE: Record<string, Demo> = {
  squat: squatDemo,
  deadlift: deadliftDemo,
  'romanian-deadlift': rdlDemo,
  'barbell-row': rowDemo,
  'overhead-press': pressDemo,
  'bench-press': benchDemo,
  'hip-thrust': hipThrustDemo,
  ...CHEST_DEMOS,
  ...BACK_DEMOS,
  ...LEGS_DEMOS,
  ...SHOULDER_DEMOS,
  ...ARM_DEMOS,
  ...CORE_DEMOS,
};

/** 加上 3D 用的握距、站距 */
export const DEMOS: Record<string, Demo> = Object.fromEntries(
  Object.entries(BASE).map(([id, demo]) => [id, WIDTHS[id] ? { ...demo, width: { ...WIDTHS[id], ...demo.width } } : demo]),
);

export const hasDemo = (exerciseId: string) => Object.prototype.hasOwnProperty.call(DEMOS, exerciseId);
