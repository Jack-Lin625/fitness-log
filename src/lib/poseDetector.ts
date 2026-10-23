/**
 * 用 MediaPipe 的 Pose Landmarker 逐格偵測影片裡的關節位置（全部在手機上執行，影片不會上傳）
 *
 * - 分析程式（wasm，約 13 MB）放在網站自己的 mediapipe/ 資料夾（建置時從套件複製，見 vite.config.ts）
 * - 模型（約 9 MB）從 Google 的伺服器下載
 * - 兩個都只在第一次使用時下載，之後由 Service Worker 存在手機裡，離線也能用
 */
import type { PoseLandmarker } from '@mediapipe/tasks-vision';
import type { PoseFrame } from './formCheck/track';

export const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task';
const WASM_DIR = `${import.meta.env.BASE_URL}mediapipe/${__MEDIAPIPE_VERSION__}/`;

/** 每秒分析幾格：深蹲、硬舉的速度 15 格就夠，分析時間也比較短 */
export const ANALYSIS_FPS = 15;
/** 影片最長幾秒 */
export const MAX_SECONDS = 90;

export type Progress =
  | { stage: 'download'; loaded: number; total: number }
  | { stage: 'init' }
  | { stage: 'analyze'; done: number; total: number };

/** 下載檔案並回報進度 */
async function download(url: string, onBytes: (n: number) => void): Promise<Uint8Array> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new Error('下載分析模型失敗，請確認網路（只有第一次需要網路）');
  }
  if (!res.ok || !res.body) throw new Error(`下載分析模型失敗（${res.status}）`);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.byteLength;
    onBytes(value.byteLength);
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

let landmarker: Promise<PoseLandmarker> | null = null;
/** 偵測器的時間戳必須一直增加，分析下一段影片時要接在上一段後面 */
let lastTimestamp = 0;

/** 載入偵測器（只載一次） */
export function loadDetector(onProgress: (p: Progress) => void): Promise<PoseLandmarker> {
  landmarker ??= (async () => {
    const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');
    const simd = await FilesetResolver.isSimdSupported();
    const name = simd ? 'vision_wasm_internal' : 'vision_wasm_nosimd_internal';
    const base = new URL(WASM_DIR, location.href).href;
    // 大概的大小，只用來畫進度條
    const total = 13.5e6 + 9.4e6;
    let loaded = 0;
    const onBytes = (n: number) => {
      loaded += n;
      onProgress({ stage: 'download', loaded, total: Math.max(total, loaded) });
    };
    const [wasm, model] = await Promise.all([download(`${base}${name}.wasm`, onBytes), download(MODEL_URL, onBytes)]);
    onProgress({ stage: 'init' });
    const wasmUrl = URL.createObjectURL(new Blob([wasm], { type: 'application/wasm' }));
    const create = (delegate: 'GPU' | 'CPU') =>
      PoseLandmarker.createFromOptions(
        { wasmLoaderPath: `${base}${name}.js`, wasmBinaryPath: wasmUrl },
        {
          baseOptions: { modelAssetBuffer: model, delegate },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        },
      );
    // 手機的 GPU 比較快；不支援時改用 CPU
    return create('GPU').catch(() => create('CPU'));
  })().catch((err: unknown) => {
    landmarker = null; // 下次再試
    throw err;
  });
  return landmarker;
}

/** 等待某個事件（逾時就失敗） */
function once(target: HTMLVideoElement, event: string, timeoutMs = 8000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      target.removeEventListener(event, done);
      reject(new Error('影片讀取逾時'));
    }, timeoutMs);
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    target.addEventListener(event, done, { once: true });
  });
}

/**
 * 等到讀得到影片的長度和大小（之後逐格跳到指定時間時才會讀取每一格的畫面）；讀不到時說明原因。
 * 不等第一格畫面：iPhone 在低耗電模式下不能自動播放，不播放就不會先讀取畫面。
 */
function waitReady(video: HTMLVideoElement, timeoutMs = 20000): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener('loadedmetadata', ok);
      video.removeEventListener('loadeddata', ok);
      video.removeEventListener('error', fail);
    };
    const ok = () => {
      if (video.readyState < 1 || !video.videoWidth) return;
      cleanup();
      resolve();
    };
    const fail = () => {
      cleanup();
      const code = video.error?.code;
      reject(
        new Error(
          code === 4
            ? '這支手機無法播放這個影片格式。iPhone 可以到「設定 → 相機 → 格式」改成「最相容」後重新錄影。'
            : '無法讀取這段影片，請換一段試試看',
        ),
      );
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('讀取影片太久了，請換一段比較短的影片試試看'));
    }, timeoutMs);
    video.addEventListener('loadedmetadata', ok);
    video.addEventListener('loadeddata', ok);
    video.addEventListener('error', fail);
  });
}

export interface DetectedVideo {
  frames: PoseFrame[];
  width: number;
  height: number;
  duration: number;
}

/** 逐格偵測整段影片 */
export async function detectVideo(
  file: Blob,
  onProgress: (p: Progress) => void,
  signal?: AbortSignal,
): Promise<DetectedVideo> {
  const detector = await loadDetector(onProgress);
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  // iPhone 的 Safari：要靜音、可以在頁面內播放，而且影片要放在頁面上（看不到也可以）才會讀取畫面
  video.muted = true;
  video.defaultMuted = true;
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  video.playsInline = true;
  video.preload = 'auto';
  Object.assign(video.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    width: '2px',
    height: '2px',
    opacity: '0',
    pointerEvents: 'none',
  });
  document.body.appendChild(video);
  try {
    const ready = waitReady(video);
    video.src = url;
    video.load();
    await ready;
    // iPhone 的 Safari 播放一下再跳到指定時間比較穩（低耗電模式不能播放也沒關係）
    await video.play().catch(() => undefined);
    video.pause();
    let duration = video.duration;
    if (!Number.isFinite(duration)) {
      // 有些錄影檔（例如瀏覽器錄的 webm）沒有寫長度：跳到最後面讓瀏覽器算出來
      video.currentTime = 1e101;
      await once(video, 'durationchange', 4000).catch(() => undefined);
      duration = video.duration;
      video.currentTime = 0;
    }
    if (!Number.isFinite(duration) || duration <= 0) throw new Error('無法讀取影片長度');
    if (duration > MAX_SECONDS) throw new Error(`影片太長了（最多 ${MAX_SECONDS} 秒），請只錄一組`);

    const frames: PoseFrame[] = [];
    const total = Math.floor(duration * ANALYSIS_FPS) + 1;
    const base = lastTimestamp + 1000;
    for (let i = 0; i < total; i++) {
      if (signal?.aborted) throw new DOMException('已取消', 'AbortError');
      const t = Math.min(i / ANALYSIS_FPS, duration - 0.001);
      video.currentTime = t;
      await once(video, 'seeked');
      // 時間戳必須一直增加（毫秒）
      lastTimestamp = base + Math.round(t * 1000) + i;
      const result = detector.detectForVideo(video, lastTimestamp);
      const lms = result.landmarks[0];
      frames.push({ t, landmarks: lms ? lms.map((l) => ({ x: l.x, y: l.y, z: l.z, visibility: l.visibility })) : null });
      onProgress({ stage: 'analyze', done: i + 1, total });
    }
    return { frames, width: video.videoWidth, height: video.videoHeight, duration };
  } finally {
    video.pause();
    video.removeAttribute('src');
    video.load();
    video.remove();
    URL.revokeObjectURL(url);
  }
}
