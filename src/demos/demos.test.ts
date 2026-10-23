import { describe, expect, it } from 'vitest';
import { DEFAULT_EXERCISES } from '../data/defaultExercises';
import { hasGuide } from '../data/exerciseGuides';
import { DEMOS } from './index';
import { BODY, type Demo, type FrontLimbs, type FrontPose, type Pose, type Prop, type SideDemo, type Vec } from './types';

const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
const STEPS = Array.from({ length: 21 }, (_, i) => i / 20);
const MIDFOOT = 101;

/** 側面示範的姿勢（力學測試用） */
const sidePose = (id: string, p: number): Pose => (DEMOS[id] as SideDemo).pose(p);

/** 器材上所有的點 */
function propPoints(props: Prop[] | undefined): Vec[] {
  return (props ?? []).flatMap((pr): Vec[] => {
    switch (pr.kind) {
      case 'pad':
      case 'cable':
      case 'band':
        return [pr.a, pr.b];
      case 'frame':
        return pr.pts;
      case 'box':
        return [{ x: pr.x, y: pr.y }, { x: pr.x + pr.w, y: pr.y + pr.h }];
      default:
        return [pr.at];
    }
  });
}

function bodyPoints(demo: Demo, pose: Pose | FrontPose): Vec[] {
  if (demo.kind === 'front') {
    const f = pose as FrontPose;
    const limbs = (s: FrontLimbs) => Object.values(s) as Vec[];
    return [f.head, f.neck, f.pelvis, ...limbs(f.l), ...limbs(f.r)];
  }
  const s = pose as Pose;
  const { far, props: _p, ...joints } = s;
  return [...(Object.values(joints) as Vec[]), ...(Object.values(far ?? {}) as Vec[])];
}

describe('每個內建動作都有假人示範', () => {
  it.each(DEFAULT_EXERCISES.map((e) => [e.id, e.name]))('%s（%s）', (id) => {
    expect(DEMOS[id], `${id} 沒有示範`).toBeDefined();
  });
});

describe.each(Object.entries(DEMOS))('假人示範：%s', (id, demo) => {
  const poses: (Pose | FrontPose)[] = STEPS.map((p) => demo.pose(p));

  it('對應到有教學的內建動作', () => {
    expect(DEFAULT_EXERCISES.some((e) => e.id === id)).toBe(true);
    expect(hasGuide(id)).toBe(true);
  });

  it('所有座標都是有效數字', () => {
    for (const pose of poses) {
      for (const v of [...bodyPoints(demo, pose), ...propPoints(pose.props)]) {
        expect(Number.isFinite(v.x) && Number.isFinite(v.y)).toBe(true);
      }
    }
  });

  it('整個人和器材都在畫面內', () => {
    const top = demo.view?.top ?? -10;
    const bottom = top + (demo.view?.height ?? 220);
    for (const pose of poses) {
      for (const v of [...bodyPoints(demo, pose), ...propPoints(pose.props), ...propPoints(demo.props)]) {
        expect(v.x).toBeGreaterThanOrEqual(0);
        expect(v.x).toBeLessThanOrEqual(200);
        expect(v.y).toBeGreaterThanOrEqual(top + 10); // 頭和槓片有半徑，留一點邊
        expect(v.y).toBeLessThanOrEqual(Math.min(bottom, 205));
      }
    }
  });

  if (demo.kind === 'front') {
    it('骨頭長度不會超過實際長度（正面可以因為往前伸而看起來變短）', () => {
      for (const pose of poses as FrontPose[]) {
        for (const s of [pose.l, pose.r]) {
          expect(dist(s.shoulder, s.elbow)).toBeLessThanOrEqual(BODY.upperArm + 0.5);
          expect(dist(s.elbow, s.hand)).toBeLessThanOrEqual(BODY.forearm + 0.5);
          expect(dist(s.hip, s.knee)).toBeLessThanOrEqual(BODY.thigh + 0.5);
          expect(dist(s.knee, s.ankle)).toBeLessThanOrEqual(BODY.shin + 0.5);
        }
        expect(dist(pose.pelvis, pose.neck)).toBeLessThanOrEqual(BODY.torso + BODY.neck + 0.5);
      }
    });
    if (demo.grounded !== false) {
      it('腳底貼地', () => {
        for (const pose of poses as FrontPose[]) {
          expect(pose.l.toe.y).toBeCloseTo(198, 0);
          expect(pose.r.toe.y).toBeCloseTo(198, 0);
        }
      });
    }
    return;
  }

  const sides = poses as Pose[];
  const flex = new Set(demo.flex ?? []);

  it('骨頭長度全程不變（大腿、小腿、軀幹、上臂、前臂，以及遠側的手腳）', () => {
    for (const pose of sides) {
      expect(dist(pose.ankle, pose.knee)).toBeCloseTo(BODY.shin, 0);
      expect(dist(pose.knee, pose.hip)).toBeCloseTo(BODY.thigh, 0);
      if (!flex.has('torso')) expect(dist(pose.hip, pose.shoulder)).toBeCloseTo(BODY.torso, 0);
      expect(dist(pose.shoulder, pose.elbow)).toBeCloseTo(BODY.upperArm, 0);
      expect(dist(pose.elbow, pose.hand)).toBeCloseTo(BODY.forearm, 0);
      const far = pose.far;
      if (far?.knee && !flex.has('farLeg')) {
        expect(dist(far.ankle ?? pose.ankle, far.knee)).toBeCloseTo(BODY.shin, 0);
        expect(dist(far.knee, pose.hip)).toBeCloseTo(BODY.thigh, 0);
      }
      if (far?.elbow && !flex.has('farArm')) {
        expect(dist(pose.shoulder, far.elbow)).toBeCloseTo(BODY.upperArm, 0);
        expect(dist(far.elbow, far.hand ?? pose.hand)).toBeCloseTo(BODY.forearm, 0);
      }
    }
  });

  if (demo.grounded !== false) {
    it('腳底貼地', () => {
      for (const pose of sides) {
        expect(pose.heel.y).toBeCloseTo(198, 0);
        expect(pose.toe.y).toBeCloseTo(198, 0);
      }
    });
  }

  it('腳掌長度固定', () => {
    for (const pose of sides) {
      expect(dist(pose.heel, pose.toe)).toBeCloseTo(BODY.footBack + BODY.footFront, 0);
    }
  });
});

describe('力學限制', () => {
  it.each(['deadlift', 'romanian-deadlift'])('%s：槓鈴全程在腳掌中心正上方', (id) => {
    for (const p of STEPS) expect(sidePose(id, p).bar!.x).toBeCloseTo(MIDFOOT, 0);
  });

  it('划船：起點槓在腳掌中心上方，膝蓋只微彎（大腿與垂直線不超過 50 度）', () => {
    const start = sidePose('barbell-row', 0);
    expect(start.bar!.x).toBeCloseTo(MIDFOOT, 0);
    const thighFromVertical = (Math.atan2(start.knee.x - start.hip.x, start.knee.y - start.hip.y) * 180) / Math.PI;
    expect(Math.abs(thighFromVertical)).toBeLessThan(50);
  });

  it('硬舉：最低點槓片貼地', () => {
    expect(sidePose('deadlift', 1).bar!.y + 15).toBeCloseTo(198, 0);
  });

  it.each(['squat', 'deadlift', 'romanian-deadlift', 'barbell-row', 'overhead-press', 'front-squat', 'goblet-squat'])(
    '%s：站姿時膝蓋往前彎，不會反折',
    (id) => {
      for (const p of STEPS) {
        const { ankle, knee, hip } = sidePose(id, p);
        // 膝蓋在腳踝—髖連線的前方（叉積為正）
        const cross = (hip.x - ankle.x) * (knee.y - ankle.y) - (hip.y - ankle.y) * (knee.x - ankle.x);
        expect(cross).toBeGreaterThanOrEqual(-0.5);
      }
    },
  );

  it('羅馬尼亞硬舉：膝蓋幾乎不動，動作在髖', () => {
    expect(dist(sidePose('romanian-deadlift', 0).knee, sidePose('romanian-deadlift', 1).knee)).toBeLessThan(3);
  });

  it('臀推：頂端肩膀到膝蓋接近一直線、小腿接近垂直', () => {
    const top = sidePose('hip-thrust', 1);
    const torso = Math.atan2(top.hip.y - top.shoulder.y, top.hip.x - top.shoulder.x);
    const thigh = Math.atan2(top.knee.y - top.hip.y, top.knee.x - top.hip.x);
    expect(Math.abs(torso - thigh)).toBeLessThan((15 * Math.PI) / 180);
    expect(Math.abs(top.knee.x - top.ankle.x)).toBeLessThan(6);
  });

  it.each(['overhead-press', 'db-shoulder-press', 'smith-shoulder-press'])('%s：頂端手在肩膀正上方、手臂伸直', (id) => {
    const top = sidePose(id, 1);
    expect(Math.abs(top.hand.x - top.shoulder.x)).toBeLessThan(5);
    expect(dist(top.shoulder, top.hand)).toBeGreaterThan(BODY.upperArm + BODY.forearm - 2);
  });

  it.each(['bench-press', 'incline-bench-press', 'db-bench-press', 'close-grip-bench'])('%s：推到頂端時手在肩膀正上方', (id) => {
    const top = sidePose(id, 0);
    expect(Math.abs(top.hand.x - top.shoulder.x)).toBeLessThan(5);
    expect(top.hand.y).toBeLessThan(top.shoulder.y - 40);
  });

  it.each(['barbell-curl', 'db-curl', 'hammer-curl', 'cable-curl', 'ez-curl', 'reverse-curl'])('%s：彎舉時上臂不動，只有前臂轉動', (id) => {
    const a = sidePose(id, 0);
    const b = sidePose(id, 1);
    expect(dist(a.elbow, b.elbow)).toBeLessThan(4);
    expect(b.hand.y).toBeLessThan(a.hand.y - 30);
  });

  it.each(['triceps-pushdown', 'rope-pushdown'])('%s：下壓時上臂貼著身體不動', (id) => {
    expect(dist(sidePose(id, 0).elbow, sidePose(id, 1).elbow)).toBeLessThan(4);
  });

  it.each(['pull-up', 'chin-up', 'neutral-pull-up'])('%s：手固定在單槓，身體往上', (id) => {
    const a = sidePose(id, 0);
    const b = sidePose(id, 1);
    expect(dist(a.hand, b.hand)).toBeLessThan(1);
    expect(b.shoulder.y).toBeLessThan(a.shoulder.y - 20);
  });

  it.each(['push-up', 'diamond-push-up', 'incline-push-up'])('%s：手撐不動，身體保持一直線', (id) => {
    for (const p of STEPS) {
      const pose = sidePose(id, p);
      expect(dist(pose.hand, sidePose(id, 0).hand)).toBeLessThan(1);
      // 腳踝、髖、肩接近一直線
      const a = Math.atan2(pose.hip.y - pose.ankle.y, pose.hip.x - pose.ankle.x);
      const b = Math.atan2(pose.shoulder.y - pose.hip.y, pose.shoulder.x - pose.hip.x);
      expect(Math.abs(a - b)).toBeLessThan((12 * Math.PI) / 180);
    }
  });

  it.each(['walking-lunge', 'reverse-lunge', 'bulgarian-split-squat'])('%s：前腳膝蓋不超過腳尖太多、後膝接近地面', (id) => {
    const bottom = sidePose(id, 1);
    expect(bottom.knee.x).toBeLessThan(bottom.toe.x + 2);
    expect(bottom.far!.knee!.y).toBeGreaterThan(170);
  });
});
