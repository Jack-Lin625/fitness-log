import { squatDemo } from './squat';
import type { Demo } from './types';

/** 有假人示範的動作（逐步增加） */
export const DEMOS: Record<string, Demo> = {
  squat: squatDemo,
};

export const hasDemo = (exerciseId: string) => exerciseId in DEMOS;
