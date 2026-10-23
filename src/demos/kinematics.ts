/**
 * 假人示範共用的幾何工具
 * 角度一律以「從正上方順時針」計算：0° 朝上、90° 朝前（右）、180° 朝下、−90° 朝後（左）。
 */
import { BODY, rad, type Vec } from './types';

export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec, k: number): Vec => ({ x: a.x * k, y: a.y * k });
export const length = (a: Vec): number => Math.hypot(a.x, a.y);
export const unit = (a: Vec): Vec => scale(a, 1 / (length(a) || 1));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const lerpVec = (a: Vec, b: Vec, t: number): Vec => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });

/** 角度 → 單位向量（0° 朝上、90° 朝前） */
export const dir = (deg: number): Vec => ({ x: Math.sin(rad(deg)), y: -Math.cos(rad(deg)) });

/** 從某點往某方向走一段 */
export const toward = (from: Vec, deg: number, len: number): Vec => add(from, scale(dir(deg), len));

/**
 * 兩節肢體（大腿＋小腿、上臂＋前臂）的中間關節。
 * 兩個解中，用 prefer 打分數挑一個（例如膝蓋要在前面：p => p.x）。
 * 距離超出可及範圍時，關節放在兩端連線上（手臂伸直）。
 */
export function twoLink(a: Vec, c: Vec, l1: number, l2: number, prefer: (p: Vec) => number): Vec {
  const v = sub(c, a);
  const d = Math.min(Math.max(length(v), Math.abs(l1 - l2) + 1e-6), l1 + l2 - 1e-6);
  const base = Math.atan2(v.y, v.x);
  const angle = Math.acos((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d));
  const candidates = [base + angle, base - angle].map((t) => ({ x: a.x + l1 * Math.cos(t), y: a.y + l1 * Math.sin(t) }));
  return prefer(candidates[0]!) >= prefer(candidates[1]!) ? candidates[0]! : candidates[1]!;
}

/** 手伸向目標；搆不到時手臂伸直指向目標 */
export function reach(shoulder: Vec, target: Vec): Vec {
  const max = BODY.upperArm + BODY.forearm - 0.5;
  const v = sub(target, shoulder);
  return length(v) <= max ? target : add(shoulder, scale(unit(v), max));
}

/** 腳跟、腳尖（腳底貼地，面向右） */
export function feet(ankle: Vec): { heel: Vec; toe: Vec } {
  return { heel: { x: ankle.x - BODY.footBack, y: ankle.y + 6 }, toe: { x: ankle.x + BODY.footFront, y: ankle.y + 6 } };
}

/** 脖子與頭：沿軀幹往上，tilt 讓頭稍微低頭（正）或抬頭（負），單位度 */
export function headOn(shoulder: Vec, torsoDeg: number, tilt = 0): { neck: Vec; head: Vec } {
  const neck = toward(shoulder, torsoDeg, BODY.neck);
  return { neck, head: toward(neck, torsoDeg + tilt, BODY.headR) };
}
