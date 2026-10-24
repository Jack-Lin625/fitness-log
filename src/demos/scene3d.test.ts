import { describe, expect, it } from 'vitest';
import { makeCamera } from './camera';
import { DEMOS } from './index';
import { boundsOf, len3, sceneAt, scenePoints, sub3, type Limbs3, type Vec3 } from './scene3d';
import { BODY } from './types';
import { WIDTHS } from './widths';

const STEPS = Array.from({ length: 11 }, (_, i) => i / 10);
const VIEWS = [0, 45, 90, 135, 180, 270].flatMap((yaw) => [0, 30, 90].map((pitch) => ({ yaw, pitch })));
const dist = (a: Vec3, b: Vec3) => len3(sub3(a, b));

describe('widths.ts 只列有示範的動作', () => {
  it.each(Object.keys(WIDTHS))('%s', (id) => {
    expect(DEMOS[id]).toBeDefined();
  });
});

describe.each(Object.entries(DEMOS))('3D 示範：%s', (_id, demo) => {
  const scenes = STEPS.map((p) => sceneAt(demo, p));

  it('所有座標都是有效數字', () => {
    for (const scene of scenes) {
      for (const v of scenePoints(scene)) expect(Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z)).toBe(true);
    }
  });

  it('身體在地面上方（腳尖、腳跟另外由平面示範的測試檢查）', () => {
    for (const scene of scenes) {
      const f = scene.figure;
      const joints = (s: Limbs3) => [s.shoulder, s.elbow, s.hand, s.hip, s.knee, s.ankle];
      for (const v of [f.head, ...joints(f.l), ...joints(f.r)]) expect(v.y).toBeGreaterThan(-2);
    }
  });

  it('骨頭長度和平面示範差不多（補上的左右寬度不會把手腳拉長太多）', () => {
    const bones: [keyof Limbs3, keyof Limbs3, number][] = [
      ['hip', 'knee', BODY.thigh],
      ['knee', 'ankle', BODY.shin],
      ['shoulder', 'elbow', BODY.upperArm],
    ];
    for (const scene of scenes) {
      for (const side of [scene.figure.l, scene.figure.r]) {
        for (const [a, b, len] of bones) {
          const d = dist(side[a], side[b]);
          // 平面示範本身允許部分肢體伸縮（例如聳肩、遠側的手腳），這裡只抓明顯的錯
          expect(d, `${a}→${b}`).toBeGreaterThan(len * 0.55);
          expect(d, `${a}→${b}`).toBeLessThan(len * 1.25);
        }
      }
    }
  });

  it('從各個角度看，整個場景都在畫面內', () => {
    const bounds = boundsOf(demo);
    for (const view of VIEWS) {
      const cam = makeCamera(view, bounds);
      const { x, y, w, h } = cam.viewBox;
      for (const scene of scenes) {
        for (const v of scenePoints(scene)) {
          const pt = cam.project(v);
          expect(pt.x).toBeGreaterThanOrEqual(x);
          expect(pt.x).toBeLessThanOrEqual(x + w);
          expect(pt.y).toBeGreaterThanOrEqual(y);
          expect(pt.y).toBeLessThanOrEqual(y + h);
        }
      }
    }
  });
});

describe('正面示範還原前後深度', () => {
  it.each(['pec-deck-fly', 'cable-fly', 'db-fly', 'lateral-raise', 'band-pull-apart', 'hip-abduction'])('%s：手臂、大腿在 3D 裡恢復原本的長度', (id) => {
    for (const p of STEPS) {
      const f = sceneAt(DEMOS[id]!, p).figure;
      for (const s of [f.l, f.r]) {
        expect(dist(s.shoulder, s.elbow)).toBeCloseTo(BODY.upperArm, 0);
        expect(dist(s.hip, s.knee)).toBeCloseTo(BODY.thigh, 0);
      }
    }
  });

  it('坐姿的大腿往前伸、俯身時頭在前面', () => {
    const seated = sceneAt(DEMOS['pec-deck-fly']!, 0).figure;
    expect(seated.l.knee.x - seated.l.hip.x).toBeGreaterThan(30);
    const bent = sceneAt(DEMOS['db-rear-delt-fly']!, 0).figure;
    expect(bent.head.x).toBeGreaterThan(bent.l.hip.x + 30);
  });

  it('俯視的飛鳥：躺在椅子上，手往天花板舉、打開時往兩側', () => {
    const closed = sceneAt(DEMOS['db-fly']!, 0).figure;
    const open = sceneAt(DEMOS['db-fly']!, 1).figure;
    expect(closed.l.hand.y).toBeGreaterThan(closed.l.shoulder.y + 35);
    expect(Math.abs(open.l.hand.z - open.r.hand.z)).toBeGreaterThan(Math.abs(closed.l.hand.z - closed.r.hand.z) + 40);
  });
});

describe('側面示範補上左右寬度', () => {
  it('左右對稱：兩側手腳在 Z 的兩邊', () => {
    const f = sceneAt(DEMOS.squat!, 0.5).figure;
    expect(f.r.hand.z).toBe(-f.l.hand.z);
    expect(f.r.ankle.z).toBeGreaterThan(0);
    expect(f.l.ankle.z).toBeLessThan(0);
  });

  it('依動作的握距、站距', () => {
    expect(sceneAt(DEMOS['bench-press']!, 0).figure.r.hand.z).toBe(26);
    expect(sceneAt(DEMOS['close-grip-bench']!, 0).figure.r.hand.z).toBe(12);
    expect(sceneAt(DEMOS['sumo-squat']!, 0).figure.r.ankle.z).toBe(26);
  });

  it('單手的動作只有一個啞鈴', () => {
    const dumbbells = (id: string) => sceneAt(DEMOS[id]!, 0).shapes.filter((s) => s.kind === 'rod' && s.cls === 'mq-db-handle').length;
    expect(dumbbells('db-curl')).toBe(2);
    expect(dumbbells('db-row')).toBe(1);
  });
});
