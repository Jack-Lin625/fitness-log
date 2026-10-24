/**
 * 3D 示範的相機：繞著場景中心的垂直軸轉（方位角），再往上看下來（仰角）。
 * 方位角 0 = 從假人右側看（和平面側面示範相同，假人面向畫面右邊），90 = 從正前方看。
 */
import type { Bounds3, Vec3 } from './scene3d';

export interface View {
  /** 方位角（度） */
  yaw: number;
  /** 仰角（度），0 = 平視、90 = 正上方 */
  pitch: number;
}

/** 透視的強度：越大越接近平行投影 */
const FOCAL = 900;

export interface Projected {
  /** SVG 座標（y 往下） */
  x: number;
  y: number;
  /** 離觀看者的遠近：越大越近 */
  depth: number;
  /** 這個點的透視縮放（線條粗細、半徑用） */
  k: number;
}

export interface Camera {
  project(p: Vec3): Projected;
  /** 朝向觀看者的方向（判斷面朝哪邊用） */
  toward: Vec3;
  /** SVG viewBox */
  viewBox: { x: number; y: number; w: number; h: number };
}

export const clampPitch = (pitch: number) => Math.min(90, Math.max(0, pitch));

export function makeCamera(view: View, b: Bounds3): Camera {
  const yaw = (view.yaw * Math.PI) / 180;
  const pitch = (clampPitch(view.pitch) * Math.PI) / 180;
  const [sy, cy, sp, cp] = [Math.sin(yaw), Math.cos(yaw), Math.sin(pitch), Math.cos(pitch)];
  const midY = (b.minY + b.maxY) / 2;
  const project = (p: Vec3): Projected => {
    const x = p.x - b.cx;
    const y = p.y - midY;
    const z = p.z - b.cz;
    const sx = x * cy - z * sy;
    const zc = x * sy + z * cy;
    const up = y * cp - zc * sp;
    const depth = zc * cp + y * sp;
    const k = FOCAL / (FOCAL - depth);
    return { x: sx * k, y: -up * k, depth, k };
  };
  // 畫面範圍：場景外接圓柱（含地面）轉到這個角度、加上透視後的大小。
  // 圓柱繞垂直軸對稱，所以轉方位角時畫面大小不變，畫面才不會一直縮放
  let maxX = 0;
  let maxY = 0;
  for (const y of [b.minY, b.maxY]) {
    for (let i = 0; i < 32; i++) {
      const t = (i / 32) * Math.PI * 2;
      const pt = project({ x: b.cx + Math.cos(t) * b.radius * 1.04, y, z: b.cz + Math.sin(t) * b.radius * 1.04 });
      maxX = Math.max(maxX, Math.abs(pt.x));
      maxY = Math.max(maxY, Math.abs(pt.y));
    }
  }
  const w = 2 * maxX + 8;
  const h = 2 * maxY + 8;
  return {
    project,
    toward: { x: sy * cp, y: sp, z: cy * cp },
    viewBox: { x: -w / 2, y: -h / 2, w, h },
  };
}
