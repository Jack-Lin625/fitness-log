import { describe, expect, it } from 'vitest';
import { deadliftPose } from '../../demos/barbell';
import { squatDemo } from '../../demos/squat';
import { easeInOut, type Pose } from '../../demos/types';
import { analyzeForm } from './analyze';
import { LM, segmentReps, type Landmark, type PoseFrame } from './track';

/**
 * 用假人示範（正確的動作）產生 MediaPipe 格式的偵測結果。
 * 假人面向右邊、左側靠近鏡頭；畫面 200 × 220。
 */
const SIZE = { width: 200, height: 220 };
/** 深蹲示範是側面的 */
const squat = (p: number) => squatDemo.pose(p) as Pose;
const FPS = 15;

function landmarksOf(pose: Pose, mirror = false): Landmark[] {
  const lms: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0.2 }));
  const put = (i: number, v: { x: number; y: number }, visibility: number) => {
    const x = mirror ? SIZE.width - v.x : v.x;
    lms[i] = { x: x / SIZE.width, y: v.y / SIZE.height, visibility };
  };
  put(LM.nose, pose.head, 0.9);
  const near = [
    [LM.leftShoulder, pose.shoulder],
    [LM.leftElbow, pose.elbow],
    [LM.leftWrist, pose.hand],
    [LM.leftHip, pose.hip],
    [LM.leftKnee, pose.knee],
    [LM.leftAnkle, pose.ankle],
    [LM.leftHeel, pose.heel],
    [LM.leftFoot, pose.toe],
  ] as const;
  for (const [i, v] of near) {
    put(i, v, 0.95);
    // 遠側幾乎重疊在後面
    put(i + 1, { x: v.x - 1.5, y: v.y }, 0.6);
  }
  return lms;
}

/** 依時間產生每一格：poseAt(t) 回傳那一瞬間的姿勢 */
function video(duration: number, poseAt: (t: number) => Pose, mirror = false): PoseFrame[] {
  const frames: PoseFrame[] = [];
  for (let i = 0; i <= duration * FPS; i++) {
    const t = i / FPS;
    frames.push({ t, landmarks: landmarksOf(poseAt(t), mirror) });
  }
  return frames;
}

/** 一下的進度：站著 → 下 → 停 → 上（秒） */
function cycle(t: number, { down = 1.6, hold = 0.3, up = 1.2, top = 0.8 } = {}): number {
  const total = top + down + hold + up;
  const x = t % total;
  if (x < top) return 0;
  if (x < top + down) return easeInOut((x - top) / down);
  if (x < top + down + hold) return 1;
  return 1 - easeInOut((x - top - down - hold) / up);
}
const SQUAT_REP = 0.8 + 1.6 + 0.3 + 1.2;

const warns = (r: ReturnType<typeof analyzeForm>) => r.summary.filter((s) => s.level === 'warn').map((s) => s.id);

describe('深蹲（側面）', () => {
  it('假人示範的正確深蹲：數得出 3 下、沒有要修正的地方', () => {
    const r = analyzeForm('squat', video(SQUAT_REP * 3 + 0.8, (t) => squat(cycle(t))), SIZE);
    expect(r.error).toBeNull();
    expect(r.view).toBe('side');
    expect(r.reps).toHaveLength(3);
    expect(warns(r)).toEqual([]);
    expect(r.reps[0]!.metrics.find((m) => m.label === '深度')?.value).toMatch(/低於平行/);
    expect(r.reps[1]!.times.peak).toBeGreaterThan(r.reps[1]!.times.start);
  });

  it('面向左邊（左右相反）也一樣', () => {
    const r = analyzeForm('squat', video(SQUAT_REP * 2 + 0.8, (t) => squat(cycle(t)), true), SIZE);
    expect(r.reps).toHaveLength(2);
    expect(warns(r)).toEqual([]);
  });

  it('只蹲到一半：每一下都標出沒蹲到平行', () => {
    const r = analyzeForm('squat', video(SQUAT_REP * 3 + 0.8, (t) => squat(cycle(t) * 0.6)), SIZE);
    expect(r.reps).toHaveLength(3);
    expect(r.summary[0]).toMatchObject({ id: 'shallow', reps: [1, 2, 3] });
    expect(r.reps[0]!.issues[0]!.text).toMatch(/大腿離水平還差 \d+°/);
  });

  it('起身時臀部先抬起（軀幹往前倒）：標出早安式', () => {
    const poseAt = (t: number): Pose => {
      const p = cycle(t);
      const pose = squat(p);
      const x = t % SQUAT_REP;
      // 起身的前半段，把上半身往前多倒 25°
      const rising = x > 0.8 + 1.6 + 0.3 && p > 0.4;
      if (!rising) return pose;
      const extra = (25 * Math.PI) / 180;
      const rot = (v: { x: number; y: number }) => {
        const dx = v.x - pose.hip.x;
        const dy = v.y - pose.hip.y;
        return { x: pose.hip.x + dx * Math.cos(extra) - dy * Math.sin(extra), y: pose.hip.y + dx * Math.sin(extra) + dy * Math.cos(extra) };
      };
      return { ...pose, shoulder: rot(pose.shoulder), head: rot(pose.head), elbow: rot(pose.elbow), hand: rot(pose.hand) };
    };
    const r = analyzeForm('squat', video(SQUAT_REP * 2 + 0.8, poseAt), SIZE);
    expect(warns(r)).toContain('goodMorning');
  });

  it('最低點腳跟抬起', () => {
    const poseAt = (t: number): Pose => {
      const p = cycle(t);
      const pose = squat(p);
      return { ...pose, heel: { x: pose.heel.x, y: pose.heel.y - 12 * p } };
    };
    expect(warns(analyzeForm('squat', video(SQUAT_REP * 2 + 0.8, poseAt), SIZE))).toContain('heelLift');
  });

  it('第 3 下起身慢很多：提示接近力竭', () => {
    const poseAt = (t: number) => {
      if (t < SQUAT_REP * 2) return squat(cycle(t));
      return squat(cycle(t - SQUAT_REP * 2, { up: 3 }));
    };
    const r = analyzeForm('squat', video(SQUAT_REP * 2 + 0.8 + 1.6 + 0.3 + 3 + 0.8, poseAt), SIZE);
    expect(r.reps).toHaveLength(3);
    expect(r.summary.find((s) => s.id === 'slowdown')).toMatchObject({ level: 'info', reps: [3] });
  });

  it('關節點有雜訊、偶爾偵測不到：次數不變', () => {
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 2;
    const frames = video(SQUAT_REP * 3 + 0.8, (t) => squat(cycle(t))).map((f, i) => ({
      t: f.t,
      landmarks: i % 17 === 5 ? null : f.landmarks!.map((l) => ({ ...l, x: l.x + rand() * 0.006, y: l.y + rand() * 0.006 })),
    }));
    const r = analyzeForm('squat', frames, SIZE);
    expect(r.reps).toHaveLength(3);
    expect(warns(r)).toEqual([]);
  });
});

describe('深蹲（正面）', () => {
  /** 正面：p 是深度，cave 是起身時膝蓋往內夾的量，shift 是骨盆往（本人）左邊偏的量 */
  function frontPose(p: number, cave: number, shift: number): Landmark[] {
    const lms: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0.9 }));
    const put = (i: number, x: number, y: number) => (lms[i] = { x: x / SIZE.width, y: y / SIZE.height, visibility: 0.95 });
    const hipY = 104 + 50 * p;
    const hipX = 100 + shift * 18; // 本人的左邊在畫面右邊
    for (const [side, sgn] of [['left', 1], ['right', -1]] as const) {
      const i = side === 'left' ? 0 : 1;
      put(LM.leftShoulder + i, hipX + sgn * 17, hipY - 56 + 6 * p);
      put(LM.leftElbow + i, hipX + sgn * 22, hipY - 40);
      put(LM.leftWrist + i, hipX + sgn * 18, hipY - 56);
      put(LM.leftHip + i, hipX + sgn * 10, hipY);
      put(LM.leftKnee + i, 100 + sgn * (16 + 6 * p - cave), 150 + 6 * p);
      put(LM.leftAnkle + i, 100 + sgn * 16, 192);
      put(LM.leftHeel + i, 100 + sgn * 15, 196);
      put(LM.leftFoot + i, 100 + sgn * 22, 198);
    }
    return lms;
  }
  const frontVideo = (cave: number, shift: number) => {
    const frames: PoseFrame[] = [];
    for (let i = 0; i <= (SQUAT_REP * 2 + 0.8) * FPS; i++) {
      const t = i / FPS;
      const p = cycle(t);
      const rising = t % SQUAT_REP > 0.8 + 1.6;
      frames.push({ t, landmarks: frontPose(p, rising ? cave * p : 0, shift * p) });
    }
    return frames;
  };

  it('膝蓋往外推、骨盆置中：沒有問題，提醒深度要從側面看', () => {
    const r = analyzeForm('squat', frontVideo(0, 0), SIZE);
    expect(r.view).toBe('front');
    expect(r.reps).toHaveLength(2);
    expect(warns(r)).toEqual([]);
    expect(r.notes.join()).toMatch(/側面/);
  });

  it('起身時膝蓋內夾、骨盆偏左', () => {
    const r = analyzeForm('squat', frontVideo(12, 1), SIZE);
    expect(warns(r)).toEqual(expect.arrayContaining(['kneeCave', 'hipShift']));
    expect(r.reps[0]!.issues.find((i) => i.id === 'hipShift')?.text).toMatch(/左/);
  });
});

describe('硬舉（側面）', () => {
  /** 從地上開始：p = 1 槓在地上，0 站直 */
  const DL_REP = 0.6 + 1.3 + 0.6 + 1.6;
  const pull = (t: number) => {
    const x = t % DL_REP;
    if (x < 0.6) return 1;
    if (x < 1.9) return 1 - easeInOut((x - 0.6) / 1.3);
    if (x < 2.5) return 0;
    return easeInOut((x - 2.5) / 1.6);
  };

  it('假人示範的正確硬舉：數得出次數、沒有要修正的地方；最後站著停止錄影也算一下', () => {
    const r = analyzeForm('deadlift', video(DL_REP * 2 + 0.6 + 1.3 + 0.5, (t) => deadliftPose(pull(t))), SIZE);
    expect(r.error).toBeNull();
    expect(r.reps).toHaveLength(3);
    expect(warns(r)).toEqual([]);
    expect(r.notes.join()).toMatch(/背有沒有拱起/);
  });

  it('臀部先起來', () => {
    const poseAt = (t: number): Pose => {
      const p = pull(t);
      const pose = deadliftPose(p);
      // 離地時髖先往上、肩膀幾乎不動（軀幹變平），槓過膝後才把上半身拉起來
      const bump = Math.sin(Math.PI * p);
      const hipP = Math.max(0, p - 0.3 * bump);
      const shoulderP = Math.min(1, p + 0.25 * bump);
      return { ...pose, hip: deadliftPose(hipP).hip, knee: deadliftPose(hipP).knee, shoulder: deadliftPose(shoulderP).shoulder };
    };
    const r = analyzeForm('deadlift', video(DL_REP * 2, poseAt), SIZE);
    expect(warns(r)).toContain('hipsFirst');
  });

  it('槓往前飄、鎖定時往後仰', () => {
    const poseAt = (t: number): Pose => {
      const p = pull(t);
      const pose = deadliftPose(p);
      const drift = 22 * Math.sin(Math.PI * p);
      const hand = { x: pose.hand.x + drift, y: pose.hand.y };
      if (p > 0.05) return { ...pose, hand };
      // 站直時肩膀在髖的後面
      return { ...pose, hand, shoulder: { x: pose.hip.x - 16, y: pose.shoulder.y + 2 } };
    };
    expect(warns(analyzeForm('deadlift', video(DL_REP * 2, poseAt), SIZE))).toEqual(
      expect.arrayContaining(['barDrift', 'leanBack']),
    );
  });

  it('沒有站直就放下', () => {
    const r = analyzeForm('deadlift', video(DL_REP * 2, (t) => deadliftPose(Math.max(0.2, pull(t)))), SIZE);
    expect(r.reps).toHaveLength(2);
    expect(warns(r)).toContain('noLockout');
  });

  it('從正面拍：請改從側面拍', () => {
    const frames: PoseFrame[] = Array.from({ length: 30 }, (_, i) => {
      const lms: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
      const set = (j: number, x: number, y: number) => (lms[j] = { x, y, visibility: 0.95 });
      for (const [k, sgn] of [[0, 1], [1, -1]] as const) {
        set(LM.leftShoulder + k, 0.5 + sgn * 0.1, 0.3);
        set(LM.leftHip + k, 0.5 + sgn * 0.06, 0.55);
        set(LM.leftKnee + k, 0.5 + sgn * 0.07, 0.72);
        set(LM.leftAnkle + k, 0.5 + sgn * 0.07, 0.9);
      }
      return { t: i / FPS, landmarks: lms };
    });
    expect(analyzeForm('deadlift', frames, SIZE).error).toMatch(/側面/);
  });
});

describe('偵測不到人', () => {
  it('沒有偵測結果：給出拍攝建議', () => {
    const frames = Array.from({ length: 30 }, (_, i) => ({ t: i / FPS, landmarks: null }));
    expect(analyzeForm('squat', frames, SIZE).error).toMatch(/全身/);
    expect(analyzeForm('squat', [], SIZE).error).toBeTruthy();
  });

  it('站著不動：找不到完整的一下', () => {
    const r = analyzeForm('squat', video(3, () => squat(0)), SIZE);
    expect(r.error).toMatch(/找不到完整的一下/);
  });
});

describe('segmentReps', () => {
  it('遲滯：小抖動不會被算成一下', () => {
    const signal = [0, 0.1, 0, 0.1, 0, 5, 10, 5, 0, 0.2, 0, 0.3, 0];
    expect(segmentReps(signal, 3)).toEqual([{ start: 4, peak: 6, end: 8 }]);
  });
});
