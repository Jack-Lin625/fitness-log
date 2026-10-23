import { benchDemo, deadliftDemo, hipThrustDemo, pressDemo, rdlDemo, rowDemo } from './barbell';
import { squatDemo } from './squat';
import type { Demo } from './types';

/** 有假人示範的動作（逐步增加） */
export const DEMOS: Record<string, Demo> = {
  squat: squatDemo,
  deadlift: deadliftDemo,
  'romanian-deadlift': rdlDemo,
  'barbell-row': rowDemo,
  'overhead-press': pressDemo,
  'bench-press': benchDemo,
  'hip-thrust': hipThrustDemo,
};

export const hasDemo = (exerciseId: string) => Object.prototype.hasOwnProperty.call(DEMOS, exerciseId);
