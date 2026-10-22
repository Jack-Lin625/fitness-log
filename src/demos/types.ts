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
}

export const rad = (deg: number) => (deg * Math.PI) / 180;

/** 先慢後快再慢，讓動作看起來自然 */
export const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
