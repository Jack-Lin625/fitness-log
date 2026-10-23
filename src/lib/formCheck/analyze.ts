/**
 * 動作檢查：依動作的模式（profiles.ts）選擇檢查規則
 *
 * 只檢查從關節位置量得出來、而且量得準的項目。背有沒有拱起（脊椎彎曲）偵測不到。
 * 門檻刻意放寬：關節點本身有幾度的誤差，寧可少報也不要誤報。
 */
import { analyzeGeneric, analyzeHold } from './general';
import { addSlowdown, summarize, type Concentric, type PatternResult } from './helpers';
import { analyzeDeadlift, analyzeHinge, analyzeHipThrust, analyzeLunge, analyzeSquat } from './lower';
import { profileOf, VIEW_LABELS, type FormProfile, type Pattern } from './profiles';
import { buildTrack, KEY_JOINTS, UPPER_JOINTS, type Joint, type PoseFrame, type Track } from './track';
import type { FormAnalysis } from './types';
import {
  analyzeCurl,
  analyzeDip,
  analyzePress,
  analyzePulldown,
  analyzePullup,
  analyzePushup,
  analyzeRaise,
  analyzeRow,
  analyzeTriceps,
} from './upper';

/** 需要看得到腳的模式 */
const FULL_BODY: Pattern[] = ['squat', 'deadlift', 'hinge', 'lunge', 'hipThrust', 'pushup', 'hold'];

/** 用力的那一段（判斷後面有沒有變慢） */
const CONCENTRIC: Record<Pattern, Concentric | null> = {
  squat: 'fromPeak',
  deadlift: 'toPeak',
  hinge: 'fromPeak',
  lunge: 'fromPeak',
  hipThrust: 'toPeak',
  press: 'toPeak',
  pushup: 'fromPeak',
  dip: 'fromPeak',
  pullup: 'toPeak',
  pulldown: 'toPeak',
  row: 'toPeak',
  curl: 'toPeak',
  triceps: 'whole',
  raise: 'toPeak',
  hold: null,
  generic: 'whole',
};

function run(profile: FormProfile, track: Track): PatternResult {
  const o = profile.options;
  switch (profile.pattern) {
    case 'squat':
      return analyzeSquat(track);
    case 'deadlift':
      return analyzeDeadlift(track, o);
    case 'hinge':
      return analyzeHinge(track, o);
    case 'lunge':
      return analyzeLunge(track);
    case 'hipThrust':
      return analyzeHipThrust(track);
    case 'press':
      return analyzePress(track, o);
    case 'pushup':
      return analyzePushup(track);
    case 'dip':
      return analyzeDip(track);
    case 'pullup':
      return analyzePullup(track);
    case 'pulldown':
      return analyzePulldown(track, o);
    case 'row':
      return analyzeRow(track, o);
    case 'curl':
      return analyzeCurl(track, o);
    case 'triceps':
      return analyzeTriceps(track, o);
    case 'raise':
      return analyzeRaise(track, o);
    case 'hold':
      return analyzeHold(track);
    case 'generic':
      return analyzeGeneric(track);
  }
}

/** 分析一段影片的偵測結果 */
export function analyzeForm(exerciseId: string, frames: PoseFrame[], size: { width: number; height: number }): FormAnalysis {
  const profile = profileOf(exerciseId);
  const { pattern } = profile;
  const empty = (error: string, notes: string[] = [], view: Track['view'] = 'unknown'): FormAnalysis => ({
    exercise: exerciseId,
    pattern,
    view,
    reps: [],
    summary: [],
    notes,
    error,
  });
  if (frames.length === 0) return empty('影片沒有可以分析的畫面');
  const full = FULL_BODY.includes(pattern);
  const joints: Joint[] = full ? KEY_JOINTS : pattern === 'generic' ? ['shoulder', 'elbow', 'hip', 'knee'] : UPPER_JOINTS;
  const track = buildTrack(frames, size, joints);
  const notes: string[] = [];
  const scale = full ? track.legLength : track.torsoLength;
  if (track.coverage < 0.3 || scale <= 0) {
    return empty(
      full
        ? '偵測不到完整的人。請讓全身（包含腳）都在畫面裡，光線充足，背景不要有其他人。'
        : '偵測不到上半身。請讓頭、手臂和髖都在畫面裡，光線充足，背景不要有其他人。',
    );
  }
  if (track.coverage < 0.7) notes.push('有些畫面偵測不到身體，結果可能不準。請確認需要的部位都在畫面裡。');

  // 拍攝角度
  const want = profile.views.map((v) => VIEW_LABELS[v]).join('或');
  if (track.view === 'unknown') {
    notes.push(`拍攝角度是斜的，結果可能不準。這個動作請從${want}拍。`);
  } else if (pattern !== 'generic' && !profile.views.includes(track.view)) {
    return empty(`這個動作請從${want}拍（鏡頭對著身體${profile.views[0] === 'side' ? '側面' : '正面'}）。`, notes, track.view);
  }

  const result = run(profile, track);
  notes.push(...result.notes);
  if (result.reps.length === 0) {
    return empty(result.error ?? '找不到完整的一下。請錄完整的動作，從起始姿勢開始錄。', notes, track.view);
  }
  const concentric = CONCENTRIC[pattern];
  if (concentric) addSlowdown(result.reps, concentric);
  return {
    exercise: exerciseId,
    pattern,
    view: track.view,
    reps: result.reps,
    summary: summarize(result.reps),
    notes,
    error: null,
  };
}
