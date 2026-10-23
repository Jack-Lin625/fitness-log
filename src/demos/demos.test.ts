import { describe, expect, it } from 'vitest';
import { DEFAULT_EXERCISES } from '../data/defaultExercises';
import { hasGuide } from '../data/exerciseGuides';
import { DEMOS } from './index';
import { BODY, type Pose, type Vec } from './types';

const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
const STEPS = Array.from({ length: 21 }, (_, i) => i / 20);
const MIDFOOT = 101;

describe.each(Object.entries(DEMOS))('假人示範：%s', (id, demo) => {
  const poses = STEPS.map((p) => demo.pose(p));

  it('對應到有教學的內建動作', () => {
    expect(DEFAULT_EXERCISES.some((e) => e.id === id)).toBe(true);
    expect(hasGuide(id)).toBe(true);
  });

  it('所有座標都是有效數字', () => {
    for (const pose of poses) {
      for (const [name, v] of Object.entries(pose) as [keyof Pose, Vec][]) {
        expect(Number.isFinite(v.x) && Number.isFinite(v.y), `${name}`).toBe(true);
      }
    }
  });

  it('骨頭長度全程不變（大腿、小腿、軀幹、上臂、前臂）', () => {
    for (const pose of poses) {
      expect(dist(pose.ankle, pose.knee)).toBeCloseTo(BODY.shin, 0);
      expect(dist(pose.knee, pose.hip)).toBeCloseTo(BODY.thigh, 0);
      expect(dist(pose.hip, pose.shoulder)).toBeCloseTo(BODY.torso, 0);
      expect(dist(pose.shoulder, pose.elbow)).toBeCloseTo(BODY.upperArm, 0);
      expect(dist(pose.elbow, pose.hand)).toBeCloseTo(BODY.forearm, 0);
    }
  });

  it('整個人和槓都在畫面內', () => {
    const top = demo.view?.top ?? -10;
    for (const pose of poses) {
      for (const v of Object.values(pose) as Vec[]) {
        expect(v.x).toBeGreaterThanOrEqual(0);
        expect(v.x).toBeLessThanOrEqual(200);
        expect(v.y).toBeGreaterThanOrEqual(top + 12); // 頭和槓片有半徑，留一點邊
        expect(v.y).toBeLessThanOrEqual(205);
      }
    }
  });

  it('腳底貼地', () => {
    for (const pose of poses) {
      expect(pose.heel.y).toBeCloseTo(198, 0);
      expect(pose.toe.y).toBeCloseTo(198, 0);
    }
  });
});

describe('力學限制', () => {
  it.each(['deadlift', 'romanian-deadlift'])('%s：槓鈴全程在腳掌中心正上方', (id) => {
    for (const p of STEPS) expect(DEMOS[id]!.pose(p).bar!.x).toBeCloseTo(MIDFOOT, 0);
  });

  it('划船：起點槓在腳掌中心上方，膝蓋只微彎（大腿與垂直線不超過 50 度）', () => {
    const start = DEMOS['barbell-row']!.pose(0);
    expect(start.bar!.x).toBeCloseTo(MIDFOOT, 0);
    const thighFromVertical = (Math.atan2(start.knee.x - start.hip.x, start.knee.y - start.hip.y) * 180) / Math.PI;
    expect(Math.abs(thighFromVertical)).toBeLessThan(50);
  });

  it('硬舉：最低點槓片貼地', () => {
    expect(DEMOS.deadlift!.pose(1).bar!.y + 15).toBeCloseTo(198, 0);
  });

  it.each(['squat', 'deadlift', 'romanian-deadlift', 'barbell-row', 'overhead-press'])('%s：站姿時膝蓋往前彎，不會反折', (id) => {
    for (const p of STEPS) {
      const { ankle, knee, hip } = DEMOS[id]!.pose(p);
      // 膝蓋在腳踝—髖連線的前方（叉積為正）
      const cross = (hip.x - ankle.x) * (knee.y - ankle.y) - (hip.y - ankle.y) * (knee.x - ankle.x);
      expect(cross).toBeGreaterThanOrEqual(-0.5);
    }
  });

  it('羅馬尼亞硬舉：膝蓋幾乎不動，動作在髖', () => {
    const k0 = DEMOS['romanian-deadlift']!.pose(0).knee;
    const k1 = DEMOS['romanian-deadlift']!.pose(1).knee;
    expect(dist(k0, k1)).toBeLessThan(3);
  });

  it('臀推：頂端肩膀到膝蓋接近一直線、小腿接近垂直', () => {
    const top = DEMOS['hip-thrust']!.pose(1);
    const torso = Math.atan2(top.hip.y - top.shoulder.y, top.hip.x - top.shoulder.x);
    const thigh = Math.atan2(top.knee.y - top.hip.y, top.knee.x - top.hip.x);
    expect(Math.abs(torso - thigh)).toBeLessThan((15 * Math.PI) / 180);
    expect(Math.abs(top.knee.x - top.ankle.x)).toBeLessThan(6);
  });

  it('肩推：頂端槓在肩膀正上方、手臂伸直', () => {
    const top = DEMOS['overhead-press']!.pose(1);
    expect(Math.abs(top.bar!.x - top.shoulder.x)).toBeLessThan(4);
    expect(dist(top.shoulder, top.hand)).toBeGreaterThan(BODY.upperArm + BODY.forearm - 2);
  });
});
