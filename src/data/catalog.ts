/**
 * 肌群與器材的中文名稱、分類
 */
import type { BodyPart, Equipment, Muscle } from '../types/models';

export const MUSCLE_LABELS: Record<Muscle, string> = {
  pecs: '胸大肌',
  upperPecs: '上胸',
  lats: '背闊肌',
  upperBack: '上背',
  traps: '斜方肌',
  lowerBack: '下背',
  frontDelts: '前三角',
  sideDelts: '側三角',
  rearDelts: '後三角',
  biceps: '二頭肌',
  triceps: '三頭肌',
  forearms: '前臂',
  quads: '股四頭肌',
  hamstrings: '腿後肌群',
  glutes: '臀大肌',
  abductors: '臀中肌',
  adductors: '內收肌',
  hipFlexors: '髖屈肌',
  calves: '小腿',
  abs: '腹直肌',
  obliques: '腹斜肌',
};

/** 肌群所屬部位 */
export const MUSCLE_PART: Record<Muscle, BodyPart> = {
  pecs: 'chest',
  upperPecs: 'chest',
  lats: 'back',
  upperBack: 'back',
  traps: 'back',
  lowerBack: 'back',
  frontDelts: 'shoulders',
  sideDelts: 'shoulders',
  rearDelts: 'shoulders',
  biceps: 'arms',
  triceps: 'arms',
  forearms: 'arms',
  quads: 'legs',
  hamstrings: 'legs',
  glutes: 'legs',
  abductors: 'legs',
  adductors: 'legs',
  hipFlexors: 'legs',
  calves: 'legs',
  abs: 'core',
  obliques: 'core',
};

/** 自訂動作沒有指定肌群時，依部位給預設值 */
export const DEFAULT_MUSCLES: Record<BodyPart, Muscle[]> = {
  chest: ['pecs'],
  back: ['lats', 'upperBack'],
  legs: ['quads', 'glutes'],
  shoulders: ['frontDelts', 'sideDelts'],
  arms: ['biceps', 'triceps'],
  core: ['abs'],
};

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: '槓鈴',
  ezbar: '曲槓',
  trapbar: '六角槓',
  dumbbell: '啞鈴',
  kettlebell: '壺鈴',
  band: '彈力帶',
  cable: '纜繩機',
  smith: '史密斯機',
  'chest-press-machine': '胸推機',
  'pec-deck': '蝴蝶機',
  'shoulder-press-machine': '肩推機',
  'lateral-raise-machine': '側平舉機',
  'lat-pulldown': '滑輪下拉機',
  'seated-row-machine': '划船機',
  tbar: 'T 槓划船',
  'assisted-machine': '輔助引體機',
  'leg-press': '腿推機',
  'hack-squat': '哈克深蹲機',
  'leg-extension': '腿伸機',
  'leg-curl': '腿彎舉機',
  'hip-machine': '髖內收外展機',
  'hip-thrust-machine': '臀推機',
  'calf-machine': '提踵機',
  'arm-machine': '手臂訓練機',
  'ab-machine': '腹部訓練機',
  bench: '訓練椅',
  'preacher-bench': '牧師椅',
  'back-extension': '羅馬椅',
  'pullup-bar': '單槓',
  'dip-station': '雙槓',
  'ab-wheel': '健腹輪',
  box: '跳箱',
  bodyweight: '徒手',
  other: '其他',
};

/** 選動作時的器材篩選分組 */
export type EquipmentGroup = 'free' | 'cable' | 'machine' | 'body';

export const EQUIPMENT_GROUPS: { id: EquipmentGroup; label: string; items: Equipment[] }[] = [
  { id: 'free', label: '自由重量', items: ['barbell', 'ezbar', 'trapbar', 'dumbbell', 'kettlebell', 'band'] },
  { id: 'cable', label: '纜繩・史密斯', items: ['cable', 'smith'] },
  {
    id: 'machine',
    label: '機器',
    items: [
      'chest-press-machine', 'pec-deck', 'shoulder-press-machine', 'lateral-raise-machine',
      'lat-pulldown', 'seated-row-machine', 'tbar', 'assisted-machine',
      'leg-press', 'hack-squat', 'leg-extension', 'leg-curl', 'hip-machine', 'hip-thrust-machine',
      'calf-machine', 'arm-machine', 'ab-machine',
    ],
  },
  {
    id: 'body',
    label: '徒手・其他',
    items: ['bench', 'preacher-bench', 'back-extension', 'pullup-bar', 'dip-station', 'ab-wheel', 'box', 'bodyweight', 'other'],
  },
];

/** 所有器材，依分組順序（自訂動作的器材選單用） */
export const ALL_EQUIPMENT: Equipment[] = EQUIPMENT_GROUPS.flatMap((g) => g.items);
