/**
 * 動作教學內容：準備姿勢、步驟、重點、常見錯誤與修正、呼吸、安全提醒
 * 內容依部位分檔放在 data/guides/；每個內建動作都要有教學（有測試檢查）。
 */
import { ARMS_GUIDES } from './guides/arms';
import { BACK_GUIDES } from './guides/back';
import { CHEST_GUIDES } from './guides/chest';
import { CORE_GUIDES } from './guides/core';
import { LEGS_GUIDES } from './guides/legs';
import { SHOULDERS_GUIDES } from './guides/shoulders';

export interface Mistake {
  /** 錯誤是什麼 */
  what: string;
  /** 怎麼修正 */
  fix: string;
}

export interface ExerciseGuide {
  setup: string[];
  steps: string[];
  cues: string[];
  mistakes: Mistake[];
  breathing: string;
  safety: string[];
}

export const GUIDES: Record<string, ExerciseGuide> = {
  ...CHEST_GUIDES,
  ...BACK_GUIDES,
  ...LEGS_GUIDES,
  ...SHOULDERS_GUIDES,
  ...ARMS_GUIDES,
  ...CORE_GUIDES,
};

/** 只認自己的 key（用 in 的話，「toString」這類內建名稱也會被當成有教學） */
export const hasGuide = (exerciseId: string) => Object.prototype.hasOwnProperty.call(GUIDES, exerciseId);
