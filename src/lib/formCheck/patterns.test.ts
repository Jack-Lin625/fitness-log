import { describe, expect, it } from 'vitest';
import { DEFAULT_EXERCISES } from '../../data/defaultExercises';
import { DEMOS } from '../../demos';
import type { FrontPose, Pose } from '../../demos/types';
import { DEMO_FPS, DEMO_SIZE, demoProgress, demoVideo, frontLandmarks, holdVideo, repSeconds, sideLandmarks } from '../../test/demoVideo';
import { analyzeForm } from './analyze';
import { canCheck, profileOf } from './profiles';
import type { PoseFrame } from './track';

const warns = (r: ReturnType<typeof analyzeForm>) => r.summary.filter((s) => s.level === 'warn').map((s) => s.id);
/** 假人示範的羅馬尼亞硬舉類膝蓋彎得比實際多（為了畫面），用下面另外做的資料測 */
const DRAWN_DIFFERENTLY = new Set(['romanian-deadlift', 'db-romanian-deadlift', 'stiff-leg-deadlift', 'good-morning']);

/** 用示範產生影片，progress 可以改變每一下的進度（模擬做錯） */
function video(id: string, progress?: (p: number, t: number) => number, tweak?: (pose: Pose | FrontPose, p: number) => Pose | FrontPose) {
  const demo = DEMOS[id]!;
  if (!tweak) return demoVideo(demo, 3, progress);
  const duration = repSeconds(demo) * 3 + demo.timing.topHold;
  const frames: PoseFrame[] = [];
  for (let i = 0; i <= duration * DEMO_FPS; i++) {
    const t = i / DEMO_FPS;
    const p = (progress ?? ((x: number) => x))(demoProgress(demo, t), t);
    const pose = tweak(demo.pose(p), p);
    frames.push({ t, landmarks: demo.kind === 'front' ? frontLandmarks(pose as FrontPose) : sideLandmarks(pose as Pose) });
  }
  return frames;
}

describe('所有動作的假人示範（正確的動作）', () => {
  for (const e of DEFAULT_EXERCISES) {
    if (!canCheck(e.id) || DRAWN_DIFFERENTLY.has(e.id)) continue;
    it(`${e.name}：數得出次數、沒有要修正的地方`, () => {
      const demo = DEMOS[e.id]!;
      const hold = profileOf(e.id).pattern === 'hold';
      const r = analyzeForm(e.id, hold ? holdVideo(demo, 1, 5) : demoVideo(demo), DEMO_SIZE);
      expect(r.error).toBeNull();
      expect(r.reps).toHaveLength(hold ? 1 : 3);
      expect(warns(r)).toEqual([]);
    });
  }

  it('手腕彎舉偵測不到（手腕的彎曲沒有關節點）', () => {
    expect(canCheck('wrist-curl')).toBe(false);
    expect(canCheck('squat')).toBe(true);
  });

  it('自訂動作用通用檢查', () => {
    expect(profileOf('custom-123').pattern).toBe('generic');
  });
});

describe('各種常見問題抓得到', () => {
  const cases: [string, string, (p: number) => number][] = [
    ['overhead-press', 'pressLockout', (p) => p * 0.6],
    ['push-up', 'pushupShallow', (p) => p * 0.25],
    ['dips', 'dipShallow', (p) => p * 0.4],
    ['pull-up', 'chinNotOver', (p) => p * 0.6],
    ['pull-up', 'noDeadHang', (p) => 0.35 + p * 0.65],
    ['lat-pulldown', 'pulldownShallow', (p) => p * 0.45],
    ['barbell-row', 'rowShallow', (p) => p * 0.45],
    ['db-curl', 'curlNoExtend', (p) => 0.4 + p * 0.6],
    ['triceps-pushdown', 'tricepsNoLockout', (p) => p * 0.55],
    ['lateral-raise', 'raiseLow', (p) => p * 0.55],
    ['walking-lunge', 'shallowLunge', (p) => p * 0.45],
    ['hip-thrust', 'hipNotExtended', (p) => p * 0.6],
  ];
  for (const [id, issue, progress] of cases) {
    it(`${id}：${issue}`, () => {
      const r = analyzeForm(id, video(id, progress), DEMO_SIZE);
      expect(r.error).toBeNull();
      expect(warns(r)).toContain(issue);
    });
  }

  it('伏地挺身塌腰、棒式塌腰', () => {
    const sag = (pose: Pose | FrontPose, dy = 9) => ({ ...(pose as Pose), hip: { x: (pose as Pose).hip.x, y: (pose as Pose).hip.y + dy } });
    expect(warns(analyzeForm('push-up', video('push-up', undefined, (pose) => sag(pose)), DEMO_SIZE))).toContain('hipSag');
    const plank = DEMOS.plank!;
    const frames = holdVideo(plank, 1, 5);
    // 假人的棒式本來臀部就稍微高一點
    const pose = sag(plank.pose(1), 16);
    const sagging = frames.map((f) => ({ t: f.t, landmarks: sideLandmarks(pose as Pose) }));
    expect(warns(analyzeForm('plank', sagging, DEMO_SIZE))).toContain('hipSag');
    expect(analyzeForm('plank', frames, DEMO_SIZE).reps[0]!.metrics[0]!.value).toBe('5.0 秒');
  });

  it('側平舉左右手不一樣高', () => {
    const r = analyzeForm(
      'lateral-raise',
      video('lateral-raise', undefined, (pose, p) => {
        const low = DEMOS['lateral-raise']!.pose(p * 0.6) as FrontPose;
        return { ...(pose as FrontPose), r: low.r };
      }),
      DEMO_SIZE,
    );
    expect(warns(r)).toContain('raiseAsym');
    expect(r.reps[0]!.issues.find((i) => i.id === 'raiseAsym')?.text).toMatch(/右手比較低/);
  });

  it('通用檢查：其中一下幅度比較小', () => {
    const demo = DEMOS['leg-extension']!;
    const r = analyzeForm(
      'leg-extension',
      video('leg-extension', (p, t) => (t > repSeconds(demo) && t < repSeconds(demo) * 2 ? p * 0.5 : p)),
      DEMO_SIZE,
    );
    expect(r.pattern).toBe('generic');
    expect(r.summary.find((s) => s.id === 'partialRom')?.reps).toEqual([2]);
  });

  it('拍攝角度不對：請改從建議的角度拍', () => {
    // 側平舉要從正面拍，給它側面的影片
    const r = analyzeForm('lateral-raise', demoVideo(DEMOS['front-raise']!), DEMO_SIZE);
    expect(r.error).toMatch(/正前方/);
  });
});

describe('髖鉸鏈（羅馬尼亞硬舉）', () => {
  /** 側面、面向右邊：knee 是膝蓋角度、hip 是髖角度（度），drift 是槓往前多少 */
  function rdl(knee: (p: number) => number, hip: (p: number) => number, drift = 0): PoseFrame[] {
    const rad = (d: number) => (d * Math.PI) / 180;
    const frames: PoseFrame[] = [];
    const cycle = 0.6 + 2 + 0.4 + 1.3;
    for (let i = 0; i <= (cycle * 3 + 0.6) * DEMO_FPS; i++) {
      const t = i / DEMO_FPS;
      const p = demoProgress({ ...DEMOS.squat!, timing: { topHold: 0.6, down: 2, bottomHold: 0.4, up: 1.3 } }, t);
      const ankle = { x: 100, y: 192 };
      const midfoot = ankle.x + 7.5;
      // 給定小腿前傾角，算出整個身體；實際做的時候髖會往後推，讓槓保持在腳掌中間上方，
      // 所以用二分法找出讓手（槓）在腳掌中間正上方的小腿角度
      const bodyAt = (shinDeg: number) => {
        const shin = rad(shinDeg);
        const kneeP = { x: ankle.x + 44 * Math.sin(shin), y: ankle.y - 44 * Math.cos(shin) };
        // 膝蓋角度 = 180 − (大腿後傾 + 小腿前傾)
        const thigh = rad(180 - knee(p)) - shin;
        const hipP = { x: kneeP.x - 46 * Math.sin(thigh), y: kneeP.y - 46 * Math.cos(thigh) };
        // 髖角度 = 180 − 前傾 − 大腿後傾
        const torso = rad(180 - hip(p)) - thigh;
        const shoulder = { x: hipP.x + 56 * Math.sin(torso), y: hipP.y - 56 * Math.cos(torso) };
        const hand = { x: shoulder.x + drift * Math.sin(Math.PI * p), y: shoulder.y + 48 };
        return { kneeP, hipP, torso, shoulder, hand };
      };
      let lo = -40;
      let hi = 60;
      for (let k = 0; k < 40; k++) {
        const m = (lo + hi) / 2;
        // 小腿越前傾，整個身體越往前
        if (bodyAt(m).hand.x - drift * Math.sin(Math.PI * p) < midfoot) lo = m;
        else hi = m;
      }
      const { kneeP, hipP, torso, shoulder, hand } = bodyAt((lo + hi) / 2);
      const pose: Pose = {
        head: { x: shoulder.x + 14 * Math.sin(torso), y: shoulder.y - 14 * Math.cos(torso) - 6 },
        neck: shoulder,
        shoulder,
        elbow: { x: (shoulder.x + hand.x) / 2, y: shoulder.y + 25 },
        hand,
        hip: hipP,
        knee: kneeP,
        ankle,
        heel: { x: ankle.x - 7, y: ankle.y + 6 },
        toe: { x: ankle.x + 22, y: ankle.y + 6 },
      };
      frames.push({ t, landmarks: sideLandmarks(pose) });
    }
    return frames;
  }
  const lerp = (a: number, b: number) => (p: number) => a + (b - a) * p;

  it('膝蓋保持微彎、靠髖往前彎：沒有問題', () => {
    const r = analyzeForm('romanian-deadlift', rdl(lerp(170, 155), lerp(175, 85)), DEMO_SIZE);
    expect(r.reps).toHaveLength(3);
    expect(warns(r)).toEqual([]);
  });

  it('膝蓋彎太多變成蹲；槓離腿太遠', () => {
    const r = analyzeForm('romanian-deadlift', rdl(lerp(170, 100), lerp(175, 70), 25), DEMO_SIZE);
    expect(warns(r)).toEqual(expect.arrayContaining(['squatHinge', 'barDrift']));
  });
});
