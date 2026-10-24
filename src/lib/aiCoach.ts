/**
 * AI 教練：在動作教學頁問問題，由 Claude 回答。
 * 純前端 App 沒有後端，所以用使用者自己的 Anthropic API 金鑰，直接從瀏覽器呼叫 API。
 * 金鑰只存在這台裝置的 localStorage，不放進訓練資料，所以不會出現在備份檔或 Google Drive。
 */
import type Anthropic from '@anthropic-ai/sdk';
import type { ExerciseGuide } from '../data/exerciseGuides';
import type { Exercise, WeightUnit } from '../types/models';
import { EQUIPMENT_LABELS, MUSCLE_LABELS } from '../data/catalog';
import { formatSetShort } from './draft';
import type { HistoryEntry } from './exerciseHistory';

const KEY_STORAGE = 'fitness-log:anthropic-api-key';
export const COACH_MODEL = 'claude-opus-5-5';
/** 附給 AI 的最近紀錄次數 */
const HISTORY_LIMIT = 5;

export function getApiKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? '';
  } catch {
    return '';
  }
}

export function setApiKey(key: string): void {
  try {
    if (key) localStorage.setItem(KEY_STORAGE, key);
    else localStorage.removeItem(KEY_STORAGE);
  } catch {
    throw new Error('無法儲存金鑰：瀏覽器不允許儲存資料');
  }
}

/** 金鑰看起來對不對（只檢查格式，真的能不能用要呼叫 API 才知道） */
export const looksLikeApiKey = (key: string) => /^sk-ant-[\w-]{20,}$/.test(key.trim());

/** 遮住中間的金鑰，設定頁顯示用 */
export const maskApiKey = (key: string) => (key.length > 14 ? `${key.slice(0, 10)}…${key.slice(-4)}` : '••••');

export interface CoachContext {
  exercise: Exercise;
  guide: ExerciseGuide | undefined;
  /** 這個動作的歷史，新到舊 */
  history: HistoryEntry[];
  traits: { bodyweight: boolean; assisted: boolean };
  unit: WeightUnit;
}

const SYSTEM_PROMPT = `你是一位有經驗的重量訓練教練，在一個健身紀錄 App 裡回答使用者對某個動作的問題。
用台灣慣用的繁體中文回答，口吻像教練在健身房旁邊跟學員說話：直接、具體、好執行。
使用者在手機上看，回答要精簡：先一兩句說最可能的原因，再列出幾個可以馬上試的調整（姿勢、握距、重量、組數、熱身等），不需要客套開場。
不要用 Markdown 標題或表格；需要條列時用「・」開頭的短句。
如果描述像是受傷（刺痛、麻、無力、關節卡住、腫、疼痛持續好幾天或越來越嚴重），提醒先停止這個動作並給醫師或物理治療師評估，不要只靠調整動作硬撐。
下面附上這個動作的教學內容與使用者最近的紀錄，回答時可以參考，但不需要重複唸出來。`;

/** 動作資料、教學、最近紀錄整理成給 AI 看的文字 */
export function describeExercise({ exercise, guide, history, traits, unit }: CoachContext): string {
  const lines: string[] = [
    `動作：${exercise.name}（${EQUIPMENT_LABELS[exercise.equipment]}）`,
    `主要肌群：${exercise.primaryMuscles.map((m) => MUSCLE_LABELS[m]).join('、') || '未設定'}`,
  ];
  if (exercise.secondaryMuscles.length > 0) {
    lines.push(`輔助肌群：${exercise.secondaryMuscles.map((m) => MUSCLE_LABELS[m]).join('、')}`);
  }
  if (guide) {
    lines.push(
      '',
      '【App 裡的教學】',
      `準備：${guide.setup.join('；')}`,
      `步驟：${guide.steps.join('；')}`,
      `重點：${guide.cues.join('；')}`,
      `常見錯誤：${guide.mistakes.map((m) => `${m.what} → ${m.fix}`).join('；')}`,
      `呼吸：${guide.breathing}`,
      `安全：${guide.safety.join('；')}`,
    );
  }
  lines.push('', '【使用者最近的紀錄】');
  const recent = history.slice(0, HISTORY_LIMIT);
  if (recent.length === 0) {
    lines.push('還沒有紀錄。');
  } else {
    for (const h of recent) {
      const sets = h.sets
        .map((s) => `${s.isWarmup ? '熱身 ' : ''}${formatSetShort(s, traits.bodyweight, traits.assisted, unit)}`)
        .join('、');
      lines.push(`${h.date}：${sets}${h.note ? `（備註：${h.note}）` : ''}`);
    }
    lines.push(`（重量單位：${unit === 'kg' ? '公斤' : '磅'}）`);
  }
  return lines.join('\n');
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

/** 對話紀錄轉成 API 的 messages：動作資料放在第一個問題前面 */
export function buildMessages(context: string, turns: ChatTurn[]): Anthropic.Beta.BetaMessageParam[] {
  return turns.map((t, i) => ({
    role: t.role,
    content: i === 0 ? `${context}\n\n【問題】\n${t.text}` : t.text,
  }));
}

/** SDK 只在第一次發問時下載，不拖慢 App 開啟 */
let clientPromise: Promise<{ client: Anthropic; sdk: typeof import('@anthropic-ai/sdk') }> | null = null;
let clientKey = '';

function getClient(apiKey: string) {
  if (!clientPromise || clientKey !== apiKey) {
    clientKey = apiKey;
    clientPromise = import('@anthropic-ai/sdk').then((sdk) => ({
      sdk,
      // 金鑰是使用者自己的、只存在自己的裝置上，所以可以從瀏覽器直接呼叫
      client: new sdk.default({ apiKey, dangerouslyAllowBrowser: true }),
    }));
    clientPromise.catch(() => (clientPromise = null));
  }
  return clientPromise;
}

/** API 錯誤轉成看得懂的說明 */
function friendlyError(sdk: typeof import('@anthropic-ai/sdk'), err: unknown): Error {
  const A = sdk.default;
  if (err instanceof A.AuthenticationError) return new Error('API 金鑰不正確或已停用，請到「設定 → AI 教練」重新輸入');
  if (err instanceof A.PermissionDeniedError) return new Error('這把金鑰沒有使用權限，請確認 Anthropic 帳號狀態');
  if (err instanceof A.RateLimitError) return new Error('問得太快或額度用完了，請稍後再試，或到 Anthropic 主控台確認餘額');
  if (err instanceof A.BadRequestError && /credit|balance/i.test(err.message)) {
    return new Error('Anthropic 帳號餘額不足，請到主控台儲值');
  }
  if (err instanceof A.APIConnectionError) return new Error('連不上 AI 服務，請確認網路後再試');
  if (err instanceof A.APIError) return new Error(`AI 服務暫時出錯（${err.status ?? '未知'}），請稍後再試`);
  return err instanceof Error ? err : new Error('發生未知錯誤');
}

/**
 * 問 AI 教練，回答邊產生邊呼叫 onText（傳入目前為止的完整回答）。
 * 回傳完整回答；被 signal 中止時丟出 AbortError。
 */
export async function askCoach(
  apiKey: string,
  context: string,
  turns: ChatTurn[],
  onText: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const { client, sdk } = await getClient(apiKey);
  try {
    const stream = client.beta.messages.stream(
      {
        model: COACH_MODEL,
        max_tokens: 16000,
        // 一般問答不需要想很久，回答比較快也比較省
        output_config: { effort: 'low' },
        // 安全分類誤判拒答時，自動改用其他模型回答
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: SYSTEM_PROMPT,
        messages: buildMessages(context, turns),
      },
      { signal },
    );
    let text = '';
    stream.on('text', (delta) => {
      text += delta;
      onText(text);
    });
    const message = await stream.finalMessage();
    if (message.stop_reason === 'refusal' && !text) throw new Error('這個問題 AI 無法回答，換個方式描述看看');
    if (!text) throw new Error('AI 沒有回答，請再試一次');
    return text;
  } catch (err) {
    if (signal?.aborted) throw new DOMException('已取消', 'AbortError');
    throw friendlyError(sdk, err);
  }
}

/** 建議問題：依動作的主要、輔助肌群產生，點一下就能問 */
export function suggestedQuestions(exercise: Exercise): string[] {
  const primary = exercise.primaryMuscles.map((m) => MUSCLE_LABELS[m]).join('、');
  const secondary = exercise.secondaryMuscles.map((m) => MUSCLE_LABELS[m]).join('、');
  const list: string[] = [];
  if (primary && secondary) list.push(`${primary}沒什麼感覺，反而${secondary}比較酸，是哪裡做錯了？`);
  else if (primary) list.push(`做完${primary}沒什麼感覺，要怎麼改？`);
  list.push('做的時候關節不舒服，要怎麼調整？', '重量一直卡住上不去，接下來該怎麼練？');
  return list;
}
