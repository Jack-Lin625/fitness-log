import { useEffect, useRef, useState } from 'preact/hooks';
import { navigate } from '../../hooks/useHashRoute';
import { useRepository } from '../../hooks/useRepository';
import { errorMessage } from '../../lib/errors';
import { analyzeForm } from '../../lib/formCheck/analyze';
import { canCheck, filmingTips, PATTERN_CHECKS, profileOf } from '../../lib/formCheck/profiles';
import { LM, type PoseFrame } from '../../lib/formCheck/track';
import type { FormAnalysis, RepResult } from '../../lib/formCheck/types';
import { ANALYSIS_FPS, detectVideo, MAX_SECONDS, type Progress } from '../../lib/poseDetector';
import { BODY_PARTS, BODY_PART_LABELS } from '../../types/models';

/** 常用的動作排在選單最上面 */
const QUICK = ['squat', 'deadlift', 'romanian-deadlift', 'overhead-press', 'push-up', 'pull-up', 'barbell-row', 'db-curl'];

/** 骨架的連線 */
const BONES: [number, number][] = [
  [LM.leftShoulder, LM.rightShoulder],
  [LM.leftHip, LM.rightHip],
  ...(['left', 'right'] as const).flatMap((s): [number, number][] => {
    const o = s === 'left' ? 0 : 1;
    return [
      [LM.leftShoulder + o, LM.leftElbow + o],
      [LM.leftElbow + o, LM.leftWrist + o],
      [LM.leftShoulder + o, LM.leftHip + o],
      [LM.leftHip + o, LM.leftKnee + o],
      [LM.leftKnee + o, LM.leftAnkle + o],
      [LM.leftAnkle + o, LM.leftHeel + o],
      [LM.leftHeel + o, LM.leftFoot + o],
      [LM.leftAnkle + o, LM.leftFoot + o],
    ];
  }),
];

type State =
  | { kind: 'idle' }
  | { kind: 'working'; progress: Progress | null }
  | { kind: 'done'; analysis: FormAnalysis; frames: PoseFrame[]; videoUrl: string }
  | { kind: 'error'; message: string };

function progressText(p: Progress | null): { text: string; ratio: number } {
  if (!p) return { text: '讀取影片中…', ratio: 0 };
  if (p.stage === 'download') {
    return {
      text: `第一次使用，下載分析模型中（${(p.loaded / 1e6).toFixed(1)}／${(p.total / 1e6).toFixed(0)} MB）…`,
      ratio: p.loaded / p.total,
    };
  }
  if (p.stage === 'init') return { text: '準備分析程式…', ratio: 1 };
  return { text: `分析中（${p.done}／${p.total} 格）…`, ratio: p.done / p.total };
}

/** 動作檢查：錄一段影片，偵測關節位置，找出每一下的問題 */
export function FormCheck({ exerciseId }: { exerciseId: string | undefined }) {
  const repo = useRepository();
  const exercise = repo.getExercise(exerciseId ?? '') ?? repo.getExercise('squat')!;
  const profile = profileOf(exercise.id);
  const supported = canCheck(exercise.id);
  const [state, setState] = useState<State>({ kind: 'idle' });
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const all = repo.getExercises();

  // 離開頁面時停止分析、釋放影片
  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );
  useEffect(() => {
    if (state.kind !== 'done') return;
    return () => URL.revokeObjectURL(state.videoUrl);
  }, [state]);

  const analyze = async (file: File | undefined) => {
    if (!file) return;
    const abort = new AbortController();
    abortRef.current = abort;
    setState({ kind: 'working', progress: null });
    try {
      const detected = await detectVideo(file, (progress) => setState({ kind: 'working', progress }), abort.signal);
      const analysis = analyzeForm(exercise.id, detected.frames, { width: detected.width, height: detected.height });
      setState({ kind: 'done', analysis, frames: detected.frames, videoUrl: URL.createObjectURL(file) });
    } catch (err) {
      if (abort.signal.aborted) setState({ kind: 'idle' });
      else setState({ kind: 'error', message: errorMessage(err) });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const picker = (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="video/*"
        hidden
        onChange={(e) => void analyze(e.currentTarget.files?.[0])}
      />
      <button type="button" class="btn btn-primary btn-block" onClick={() => fileRef.current?.click()}>
        {state.kind === 'idle' ? '錄影或選擇影片' : '換一段影片'}
      </button>
    </>
  );

  if (state.kind === 'working') {
    const { text, ratio } = progressText(state.progress);
    return (
      <div class="tool" aria-busy="true">
        <p class="form-progress-text" role="status">
          {text}
        </p>
        <div class="form-progress" aria-hidden="true">
          <span style={{ width: `${Math.round(ratio * 100)}%` }} />
        </div>
        <p class="muted small-text">影片只在這支手機裡分析，不會上傳。</p>
        <button type="button" class="btn btn-ghost btn-block" onClick={() => abortRef.current?.abort()}>
          取消
        </button>
      </div>
    );
  }

  if (state.kind === 'done') {
    return (
      <div class="tool">
        <FormResult analysis={state.analysis} frames={state.frames} videoUrl={state.videoUrl} name={exercise.name} />
        {picker}
        <button type="button" class="btn btn-ghost btn-block" onClick={() => setState({ kind: 'idle' })}>
          看拍攝方式
        </button>
      </div>
    );
  }

  return (
    <div class="tool">
      <label class="field">
        <span class="field-label">動作</span>
        <select
          class="input select"
          value={exercise.id}
          onChange={(e) => {
            setState({ kind: 'idle' });
            navigate(`/tools/form/${encodeURIComponent(e.currentTarget.value)}`);
          }}
        >
          <optgroup label="常用">
            {QUICK.map((id) => {
              const e = repo.getExercise(id);
              return e ? (
                <option key={`q-${id}`} value={id}>
                  {e.name}
                </option>
              ) : null;
            })}
          </optgroup>
          {BODY_PARTS.map((part) => (
            <optgroup key={part} label={BODY_PART_LABELS[part]}>
              {all
                .filter((e) => e.bodyPart === part)
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>

      {state.kind === 'error' && <p class="note note-warn">{state.message}</p>}

      {supported ? (
        <>
          <section class="form-tips">
            <h2>會檢查</h2>
            <ul>
              {PATTERN_CHECKS[profile.pattern].map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <h2>怎麼拍</h2>
            <ul>
              {filmingTips(profile).map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </section>
          {picker}
        </>
      ) : (
        <p class="note note-warn">這個動作只有手腕在動，幅度太小，影片偵測不到（關節點沒有手腕的彎曲），沒辦法檢查。</p>
      )}

      <p class="note">
        {`用 AI 偵測影片裡的關節位置，量出每一下的角度和速度，找出常見的問題。影片只在這支手機裡分析，不會上傳。` +
          `第一次使用要下載約 23 MB 的分析模型，之後離線也能用。影片最長 ${MAX_SECONDS} 秒。` +
          `結果只能當參考：背有沒有拱起偵測不到，拍攝角度不正也會影響準確度。`}
      </p>
    </div>
  );
}

/** 分析結果：影片＋骨架、問題彙整、每一下的數據 */
function FormResult({
  analysis,
  frames,
  videoUrl,
  name,
}: {
  analysis: FormAnalysis;
  frames: PoseFrame[];
  videoUrl: string;
  name: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [current, setCurrent] = useState<number | null>(null);

  // 播放時把骨架畫在影片上
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    let raf = 0;
    const draw = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx || !video.videoWidth) return;
      if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
      if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const frame = frames[Math.min(frames.length - 1, Math.round(video.currentTime * ANALYSIS_FPS))];
      const rep = analysis.reps.find((r) => video.currentTime >= r.times.start && video.currentTime <= r.times.end);
      setCurrent(rep?.index ?? null);
      const lms = frame?.landmarks;
      if (!lms) return;
      const bad = rep?.issues.some((i) => i.level === 'warn');
      const w = canvas.width;
      const h = canvas.height;
      ctx.lineWidth = Math.max(3, w / 160);
      ctx.lineCap = 'round';
      ctx.strokeStyle = bad ? '#ff4d4f' : '#3ddc84';
      ctx.fillStyle = '#ffffff';
      for (const [a, b] of BONES) {
        const p = lms[a];
        const q = lms[b];
        if (!p || !q || (p.visibility ?? 1) < 0.3 || (q.visibility ?? 1) < 0.3) continue;
        ctx.beginPath();
        ctx.moveTo(p.x * w, p.y * h);
        ctx.lineTo(q.x * w, q.y * h);
        ctx.stroke();
      }
      for (const i of [LM.leftShoulder, LM.rightShoulder, LM.leftHip, LM.rightHip, LM.leftKnee, LM.rightKnee, LM.leftAnkle, LM.rightAnkle]) {
        const p = lms[i];
        if (!p || (p.visibility ?? 1) < 0.3) continue;
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, ctx.lineWidth * 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    const loop = () => {
      draw();
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [frames, analysis]);

  const seek = (rep: RepResult) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = rep.times.start;
    void video.play().catch(() => undefined);
  };

  return (
    <>
      <div class="form-video">
        <video ref={videoRef} src={videoUrl} controls playsInline muted preload="auto" />
        <canvas ref={canvasRef} aria-hidden="true" />
      </div>

      {analysis.error ? (
        <p class="note note-warn">{analysis.error}</p>
      ) : (
        <>
          <section class="form-summary" aria-label="結果">
            <h2>
              {name} {analysis.pattern === 'hold' ? '' : `${analysis.reps.length} 下`}
              {analysis.view === 'front' ? '（正面）' : analysis.view === 'side' ? '（側面）' : ''}
            </h2>
            {analysis.summary.filter((s) => s.level === 'warn').length === 0 && (
              <p class="form-ok">✓ 沒有發現需要修正的地方</p>
            )}
            {analysis.summary.map((s) => (
              <div key={s.id} class={s.level === 'warn' ? 'form-issue is-warn' : 'form-issue'}>
                <strong>{s.title}</strong>
                <span class="form-issue-reps">第 {s.reps.join('、')} 下</span>
                <p>{s.advice}</p>
              </div>
            ))}
          </section>

          <ul class="form-reps">
            {analysis.reps.map((r) => (
              <li key={r.index} class={current === r.index ? 'form-rep is-current' : 'form-rep'}>
                <button type="button" class="form-rep-head" onClick={() => seek(r)}>
                  <span>第 {r.index} 下</span>
                  <span class={r.issues.some((i) => i.level === 'warn') ? 'form-rep-flag is-warn' : 'form-rep-flag'}>
                    {r.issues.some((i) => i.level === 'warn') ? '要注意' : '✓'}
                  </span>
                  <span class="muted small-text">▶ {r.times.start.toFixed(1)} 秒</span>
                </button>
                {r.issues.length > 0 && (
                  <ul class="form-rep-issues">
                    {r.issues.map((i) => (
                      <li key={i.id} class={i.level === 'warn' ? 'is-warn' : ''}>
                        {i.text}
                      </li>
                    ))}
                  </ul>
                )}
                <dl class="form-metrics">
                  {r.metrics.map((m) => (
                    <div key={m.label}>
                      <dt>{m.label}</dt>
                      <dd>{m.value}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
        </>
      )}

      {analysis.notes.map((n) => (
        <p key={n} class="note">
          {n}
        </p>
      ))}
    </>
  );
}
