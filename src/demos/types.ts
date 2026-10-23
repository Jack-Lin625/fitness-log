/**
 * 假人動作示範的共用型別
 * 座標系：viewBox 0 0 200 220，地面 y = 200，假人面向右邊（側面視角）。
 */
export interface Vec {
  x: number;
  y: number;
}

/** 某一瞬間的姿勢（各關節位置） */
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
}

/** 一個動作的示範 */
export interface Demo {
  /** 依進度 p（0 = 起始姿勢，1 = 動作最深處）算出姿勢 */
  pose: (p: number) => Pose;
  /** 一下的時間軸（秒）：下降、底部停留、上升、頂部停留 */
  timing: { down: number; bottomHold: number; up: number; topHold: number };
  /** 各階段的說明文字 */
  captions: { down: string; bottom: string; up: string; top: string };
  /** 輔助線：在某個 x 畫一條垂直虛線（例如腳掌中心） */
  guideX?: (pose: Pose) => { x: number; label: string };
  /** 滑桿兩端的文字（p = 0、p = 1），預設「起始」「最低點」 */
  labels?: { start: string; end: string };
  /** 訓練椅（臥推、臀推）：椅面從 x1 到 x2，高度 y */
  bench?: { x1: number; x2: number; y: number };
  /** 畫面的上緣與高度（預設 −10、220）；槓舉過頭的動作需要更高 */
  view?: { top: number; height: number };
}

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
};

export const rad = (deg: number) => (deg * Math.PI) / 180;

/** 先慢後快再慢，讓動作看起來自然 */
export const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
