import { benchDemo, deadliftDemo, hipThrustDemo, pressDemo, rdlDemo, rowDemo } from './barbell';
import { ARM_DEMOS } from './arms';
import { BACK_DEMOS } from './back';
import { CHEST_DEMOS } from './chest';
import { CORE_DEMOS } from './core';
import { LEGS_DEMOS } from './legs';
import { SHOULDER_DEMOS } from './shoulders';
import { squatDemo } from './squat';
import type { Demo } from './types';

/** 有假人示範的動作 */
export const DEMOS: Record<string, Demo> = {
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

export const hasDemo = (exerciseId: string) => Object.prototype.hasOwnProperty.call(DEMOS, exerciseId);
