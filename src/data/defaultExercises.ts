import type { BodyPart, Exercise } from '../types/models';

/** 建立內建動作的小工具，讓下方清單保持簡潔 */
function ex(id: string, name: string, bodyPart: BodyPart, isBodyweight = false): Exercise {
  return { id, name, bodyPart, isBodyweight, isCustom: false };
}

/**
 * 內建動作清單。
 * id 一旦發布就不要修改，否則舊紀錄會找不到對應動作。
 */
export const DEFAULT_EXERCISES: readonly Exercise[] = [
  // 胸
  ex('bench-press', '臥推', 'chest'),
  ex('incline-bench-press', '上斜臥推', 'chest'),
  ex('db-bench-press', '啞鈴臥推', 'chest'),
  ex('db-incline-press', '上斜啞鈴臥推', 'chest'),
  ex('dips', '雙槓撐體', 'chest', true),
  ex('push-up', '伏地挺身', 'chest', true),
  ex('cable-fly', '繩索夾胸', 'chest'),
  ex('machine-chest-press', '機械胸推', 'chest'),

  // 背
  ex('deadlift', '硬舉', 'back'),
  ex('barbell-row', '槓鈴划船', 'back'),
  ex('db-row', '單臂啞鈴划船', 'back'),
  ex('pull-up', '引體向上', 'back', true),
  ex('chin-up', '反手引體向上', 'back', true),
  ex('lat-pulldown', '滑輪下拉', 'back'),
  ex('seated-cable-row', '坐姿划船', 'back'),

  // 腿
  ex('squat', '深蹲', 'legs'),
  ex('front-squat', '前蹲舉', 'legs'),
  ex('romanian-deadlift', '羅馬尼亞硬舉', 'legs'),
  ex('leg-press', '腿推', 'legs'),
  ex('bulgarian-split-squat', '保加利亞分腿蹲', 'legs'),
  ex('hip-thrust', '臀推', 'legs'),
  ex('leg-extension', '腿伸', 'legs'),
  ex('leg-curl', '腿彎舉', 'legs'),
  ex('calf-raise', '提踵', 'legs'),

  // 肩
  ex('overhead-press', '肩推', 'shoulders'),
  ex('db-shoulder-press', '啞鈴肩推', 'shoulders'),
  ex('lateral-raise', '側平舉', 'shoulders'),
  ex('rear-delt-fly', '反向飛鳥', 'shoulders'),
  ex('face-pull', '臉拉', 'shoulders'),

  // 手臂
  ex('barbell-curl', '槓鈴彎舉', 'arms'),
  ex('db-curl', '啞鈴彎舉', 'arms'),
  ex('hammer-curl', '錘式彎舉', 'arms'),
  ex('triceps-pushdown', '三頭下壓', 'arms'),
  ex('skull-crusher', '仰臥三頭伸展', 'arms'),
  ex('overhead-triceps-ext', '過頭三頭伸展', 'arms'),

  // 核心
  ex('plank', '棒式', 'core', true),
  ex('hanging-leg-raise', '懸垂舉腿', 'core', true),
  ex('cable-crunch', '繩索捲腹', 'core'),
  ex('ab-wheel', '健腹輪', 'core', true),
];
