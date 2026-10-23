/**
 * 每個動作用哪一種檢查方式
 *
 * 動作分成幾種「模式」（深蹲、髖鉸鏈、推、拉…），同一種模式的動作檢查方式相同。
 * 沒有專屬規則的動作（躺著、坐在機器上、關節位置看不清楚的動作）用通用檢查：
 * 數次數、看每一下的幅度有沒有做完整、後面有沒有變慢。
 */
import type { View } from './track';

export type Pattern =
  | 'squat'
  | 'deadlift'
  | 'hinge'
  | 'lunge'
  | 'hipThrust'
  | 'press'
  | 'pushup'
  | 'dip'
  | 'pullup'
  | 'pulldown'
  | 'row'
  | 'curl'
  | 'triceps'
  | 'raise'
  | 'hold'
  | 'generic';

/** 同一種模式裡，各動作的差異 */
export interface ProfileOptions {
  /** 站著做（檢查身體有沒有晃動借力） */
  standing?: boolean;
  /** 架上拉：從膝蓋高度開始，不檢查離地 */
  rack?: boolean;
  /** 允許用腿借力（借力推） */
  legDrive?: boolean;
  /** 用槓鈴或啞鈴（檢查有沒有離身體太遠） */
  loaded?: boolean;
  /** 俯身划船：上半身要前傾 */
  bentOver?: boolean;
  /** 單手（從動作幅度比較大的那隻手判斷） */
  single?: boolean;
  /** 允許膝蓋彎曲的角度（髖鉸鏈） */
  kneeBend?: number;
  /** 上臂要固定不動（三頭伸展） */
  fixedUpperArm?: boolean;
  /** 上半身起伏容許的度數（坐姿划船會前後擺一點） */
  swingLimit?: number;
}

export interface FormProfile {
  pattern: Pattern;
  /** 可以的拍攝角度，第一個是建議的 */
  views: ('side' | 'front')[];
  options: ProfileOptions;
}

const P = (pattern: Pattern, views: FormProfile['views'], options: ProfileOptions = {}): FormProfile => ({
  pattern,
  views,
  options,
});

const SIDE = ['side'] as FormProfile['views'];
const SIDE_FRONT = ['side', 'front'] as FormProfile['views'];
const FRONT = ['front'] as FormProfile['views'];
const FRONT_SIDE = ['front', 'side'] as FormProfile['views'];

const PROFILES: Record<string, FormProfile> = {
  // 深蹲類
  squat: P('squat', SIDE_FRONT),
  'front-squat': P('squat', SIDE_FRONT),
  'smith-squat': P('squat', SIDE_FRONT),
  'goblet-squat': P('squat', SIDE_FRONT),
  'sumo-squat': P('squat', FRONT_SIDE),
  // 哈克深蹲的身體是斜的，大腿和地面平行不代表蹲到底，用通用檢查
  // 硬舉類
  deadlift: P('deadlift', SIDE),
  'sumo-deadlift': P('deadlift', SIDE),
  'trap-bar-deadlift': P('deadlift', SIDE),
  'rack-pull': P('deadlift', SIDE, { rack: true }),
  // 髖鉸鏈
  'romanian-deadlift': P('hinge', SIDE, { loaded: true, kneeBend: 35 }),
  'db-romanian-deadlift': P('hinge', SIDE, { loaded: true, kneeBend: 35 }),
  'stiff-leg-deadlift': P('hinge', SIDE, { loaded: true, kneeBend: 25 }),
  'good-morning': P('hinge', SIDE, { kneeBend: 35 }),
  // 弓箭步、分腿蹲
  'bulgarian-split-squat': P('lunge', SIDE),
  'walking-lunge': P('lunge', SIDE),
  'reverse-lunge': P('lunge', SIDE),
  'smith-lunge': P('lunge', SIDE),
  // 臀推
  'hip-thrust': P('hipThrust', SIDE),
  'machine-hip-thrust': P('hipThrust', SIDE),
  'glute-bridge': P('hipThrust', SIDE),
  // 推
  'overhead-press': P('press', SIDE_FRONT, { standing: true }),
  'push-press': P('press', SIDE_FRONT, { standing: true, legDrive: true }),
  'db-shoulder-press': P('press', SIDE_FRONT),
  'arnold-press': P('press', SIDE_FRONT),
  'kb-press': P('press', SIDE_FRONT, { standing: true, single: true }),
  'smith-shoulder-press': P('press', SIDE_FRONT),
  'machine-shoulder-press': P('press', SIDE_FRONT),
  'push-up': P('pushup', SIDE),
  'incline-push-up': P('pushup', SIDE),
  'diamond-push-up': P('pushup', SIDE),
  dips: P('dip', SIDE),
  'assisted-dip': P('dip', SIDE),
  'bench-dip': P('dip', SIDE),
  // 拉
  'pull-up': P('pullup', SIDE_FRONT),
  'chin-up': P('pullup', SIDE_FRONT),
  'neutral-pull-up': P('pullup', SIDE_FRONT),
  'assisted-pull-up': P('pullup', SIDE_FRONT),
  'lat-pulldown': P('pulldown', SIDE),
  'close-grip-pulldown': P('pulldown', SIDE),
  'reverse-grip-pulldown': P('pulldown', SIDE),
  'single-arm-pulldown': P('pulldown', SIDE, { single: true }),
  'barbell-row': P('row', SIDE, { standing: true, bentOver: true }),
  'pendlay-row': P('row', SIDE, { standing: true, bentOver: true }),
  'tbar-row': P('row', SIDE, { standing: true, bentOver: true }),
  'db-row': P('row', SIDE, { single: true }),
  'seated-cable-row': P('row', SIDE, { standing: true, swingLimit: 30 }),
  'single-arm-cable-row': P('row', SIDE, { standing: true, single: true, swingLimit: 30 }),
  'chest-supported-db-row': P('row', SIDE),
  'machine-row': P('row', SIDE),
  'machine-high-row': P('row', SIDE),
  'inverted-row': P('row', SIDE),
  // 二頭
  'barbell-curl': P('curl', SIDE, { standing: true }),
  'ez-curl': P('curl', SIDE, { standing: true }),
  'db-curl': P('curl', SIDE, { standing: true, single: true }),
  'hammer-curl': P('curl', SIDE, { standing: true, single: true }),
  'reverse-curl': P('curl', SIDE, { standing: true }),
  'cable-curl': P('curl', SIDE, { standing: true }),
  'cable-hammer-curl': P('curl', SIDE, { standing: true }),
  'incline-db-curl': P('curl', SIDE, { single: true }),
  'preacher-curl': P('curl', SIDE),
  'concentration-curl': P('curl', SIDE, { single: true }),
  'machine-curl': P('curl', SIDE),
  // 三頭
  'triceps-pushdown': P('triceps', SIDE, { standing: true, fixedUpperArm: true }),
  'rope-pushdown': P('triceps', SIDE, { standing: true, fixedUpperArm: true }),
  'cable-overhead-triceps': P('triceps', SIDE, { fixedUpperArm: true }),
  'overhead-triceps-ext': P('triceps', SIDE, { fixedUpperArm: true }),
  'skull-crusher': P('triceps', SIDE, { fixedUpperArm: true }),
  'db-kickback': P('triceps', SIDE, { fixedUpperArm: true, single: true }),
  'machine-triceps': P('triceps', SIDE),
  // 平舉
  'lateral-raise': P('raise', FRONT),
  'cable-lateral-raise': P('raise', FRONT, { single: true }),
  'machine-lateral-raise': P('raise', FRONT),
  'front-raise': P('raise', SIDE, { standing: true }),
  // 棒式
  plank: P('hold', SIDE),
  'side-plank': P('hold', FRONT_SIDE),
};

const GENERIC: FormProfile = P('generic', SIDE_FRONT);

/** 幅度太小、關節點看不到的動作（手腕的彎曲沒有關節點） */
const UNSUPPORTED = new Set(['wrist-curl', 'reverse-wrist-curl']);

/** 這個動作能不能用影片檢查 */
export const canCheck = (exerciseId: string) => !UNSUPPORTED.has(exerciseId);

/** 動作的檢查方式；自訂動作和沒有專屬規則的動作用通用檢查 */
export function profileOf(exerciseId: string): FormProfile {
  return PROFILES[exerciseId] ?? GENERIC;
}

/** 拍攝角度的中文 */
export const VIEW_LABELS: Record<Exclude<View, 'unknown'>, string> = { side: '正側面', front: '正前方' };

/** 各模式會檢查什麼（給使用者看） */
export const PATTERN_CHECKS: Record<Pattern, string[]> = {
  squat: ['側面：深度、起身時臀部先抬起、腳跟離地、有沒有站直', '正面：膝蓋內夾、重心偏向一邊'],
  deadlift: ['臀部先起來、槓離身體太遠、有沒有站直鎖定、鎖定時往後仰'],
  hinge: ['膝蓋彎太多（變成蹲）、槓離身體太遠、有沒有站直、往後仰'],
  lunge: ['深度、前腳膝蓋位置、上半身前傾、前腳跟離地'],
  hipThrust: ['臀部有沒有推到最高、腰往上拱、腳的位置'],
  press: ['手臂有沒有推直、推到頭頂正上方、有沒有放回肩膀高度、往後仰、用腿借力'],
  pushup: ['身體一直線（塌腰、屁股翹）、深度、有沒有推直'],
  dip: ['深度、有沒有撐直'],
  pullup: ['下巴有沒有過槓、手臂有沒有放直、身體擺盪'],
  pulldown: ['有沒有拉到胸口、手臂有沒有放直、身體往後倒'],
  row: ['有沒有拉到底、手臂有沒有放直、上半身起伏、俯身角度'],
  curl: ['手臂有沒有放直、有沒有彎到頂、手肘往前跑、身體晃動'],
  triceps: ['手臂有沒有伸直、手肘有沒有跟著動、身體晃動'],
  raise: ['有沒有舉到肩膀高度、舉太高、左右手高度、身體晃動'],
  hold: ['身體一直線（塌腰、屁股翹）、撐了多久'],
  generic: ['數次數、每一下的幅度有沒有做完整、後面有沒有變慢'],
};

/** 各模式的拍攝建議 */
export function filmingTips(profile: FormProfile): string[] {
  const upper = ['press', 'pullup', 'pulldown', 'row', 'curl', 'triceps', 'raise', 'dip'].includes(profile.pattern);
  const view = profile.views.map((v) => VIEW_LABELS[v]).join('或');
  const tips = [
    upper
      ? '手機離你 2–3 公尺，頭、手臂和髖都要在畫面裡（最好全身）'
      : '手機放在約膝蓋高度、離你 2–3 公尺，全身（包含腳）都要在畫面裡',
    `從${view}拍`,
  ];
  if (profile.pattern === 'squat') tips.push('側面看深度和軀幹角度；正面看膝蓋有沒有內夾');
  if (profile.pattern === 'deadlift') tips.push(profile.options.rack ? '從槓在架上開始錄' : '從槓在地上開始錄');
  if (profile.pattern === 'hold') tips.push('從開始撐住前開始錄，撐完再停止');
  else tips.push('一段影片錄一組就好（最多 90 秒），從起始姿勢開始錄');
  return tips;
}
