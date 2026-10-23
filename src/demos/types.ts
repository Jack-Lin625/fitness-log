/**
 * 假人動作示範的共用型別
 * 座標系：viewBox 0 0 200 220，地面 y = 198（腳底），y 往下增加。
 * - 側面示範（大部分動作）：假人面向右邊。
 * - 正面示範（側平舉、飛鳥、髖外展這類往身體兩側的動作）：假人面向觀看者。
 */
export interface Vec {
  x: number;
  y: number;
}

/**
 * 器材與道具。靜態的放在 Demo.props，會跟著動作移動的放在 Pose.props。
 */
export type Prop =
  /** 粗的圓角長條：椅面、靠背、護墊、滾筒 */
  | { kind: 'pad'; a: Vec; b: Vec; w?: number }
  /** 細線：機器骨架、架子、地雷管 */
  | { kind: 'frame'; pts: Vec[] }
  /** 繩索（從滑輪到握把） */
  | { kind: 'cable'; a: Vec; b: Vec }
  /** 滑輪 */
  | { kind: 'pulley'; at: Vec }
  /** 固定的橫桿斷面（單槓、雙槓握把） */
  | { kind: 'bar'; at: Vec }
  /** 啞鈴：沒有 angle 時看到的是側面的圓（握把垂直畫面）；有 angle 時是畫面中的一根短槓（度，0 = 水平） */
  | { kind: 'dumbbell'; at: Vec; angle?: number }
  | { kind: 'kettlebell'; at: Vec }
  /** 槓片（例如機器的配重、單獨拿的槓片），r 預設 15 */
  | { kind: 'plate'; at: Vec; r?: number }
  /** 繩索握把 */
  | { kind: 'handle'; at: Vec }
  /** 跳箱、踏台 */
  | { kind: 'box'; x: number; y: number; w: number; h: number }
  /** 彈力帶 */
  | { kind: 'band'; a: Vec; b: Vec };

/** 側面：另一側（遠側）的手腳；沒有給就和近側重疊 */
export interface FarLimbs {
  elbow?: Vec;
  hand?: Vec;
  knee?: Vec;
  ankle?: Vec;
  heel?: Vec;
  toe?: Vec;
}

/** 側面某一瞬間的姿勢（各關節位置） */
export interface Pose {
  head: Vec;
  neck: Vec;
  shoulder: Vec;
  elbow: Vec;
  hand: Vec;
  hip: Vec;
  knee: Vec;
  ankle: Vec;
  heel: Vec;
  toe: Vec;
  /** 槓鈴（側面看到的是槓片正面），沒有則不畫 */
  bar?: Vec;
  /** 遠側的手腳（弓箭步、單手動作、交替動作） */
  far?: FarLimbs;
  /** 會移動的器材（啞鈴、繩索、機器的握把與護墊） */
  props?: Prop[];
}

/** 正面：一側的手腳 */
export interface FrontLimbs {
  shoulder: Vec;
  elbow: Vec;
  hand: Vec;
  hip: Vec;
  knee: Vec;
  ankle: Vec;
  /** 腳尖（正面看腳掌是一小段往外的線） */
  toe: Vec;
}

/** 正面某一瞬間的姿勢；l 是假人的左側（畫面右邊），r 是右側（畫面左邊） */
export interface FrontPose {
  head: Vec;
  neck: Vec;
  /** 骨盆中心 */
  pelvis: Vec;
  l: FrontLimbs;
  r: FrontLimbs;
  props?: Prop[];
}

interface DemoBase {
  /** 一下的時間軸（秒）：下降、底部停留、上升、頂部停留 */
  timing: { down: number; bottomHold: number; up: number; topHold: number };
  /** 各階段的說明文字 */
  captions: { down: string; bottom: string; up: string; top: string };
  /** 輔助線：在某個 x 畫一條垂直虛線（例如腳掌中心） */
  guideX?: () => { x: number; label: string };
  /** 滑桿兩端的文字（p = 0、p = 1），預設「起始」「最低點」 */
  labels?: { start: string; end: string };
  /** 訓練椅（舊寫法，等同一個 pad 加兩支椅腳）：椅面從 x1 到 x2，高度 y */
  bench?: { x1: number; x2: number; y: number };
  /** 靜態的器材 */
  props?: Prop[];
  /** 畫面的上緣與高度（預設 −10、220）；槓舉過頭的動作需要更高 */
  view?: { top: number; height: number };
  /** 是否畫地面（俯視的動作不畫），預設 true */
  floor?: boolean;
  /** 腳底全程貼地（測試會檢查），預設 true；懸吊、躺著、跪姿、墊腳尖的動作設 false */
  grounded?: boolean;
  /** 測試時允許長度改變的部位（例如聳肩時肩膀沿軀幹上提） */
  flex?: ('torso' | 'farLeg' | 'farArm')[];
}

/** 側面示範 */
export interface SideDemo extends DemoBase {
  kind?: 'side';
  /** 依進度 p（0 = 起始姿勢，1 = 動作最深處）算出姿勢 */
  pose: (p: number) => Pose;
}

/** 正面示範 */
export interface FrontDemo extends DemoBase {
  kind: 'front';
  pose: (p: number) => FrontPose;
}

export type Demo = SideDemo | FrontDemo;

/** 身體各段長度（所有動作共用同一個假人比例） */
export const BODY = {
  shin: 44,
  thigh: 46,
  torso: 56,
  neck: 9,
  headR: 10,
  upperArm: 25,
  forearm: 23,
  footBack: 7,
  footFront: 22,
  /** 正面：肩寬、髖寬的一半 */
  shoulderHalf: 15,
  hipHalf: 9,
};

export const rad = (deg: number) => (deg * Math.PI) / 180;

/** 先慢後快再慢，讓動作看起來自然 */
export const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
