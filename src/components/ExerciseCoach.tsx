import { useEffect, useRef, useState } from 'preact/hooks';
import type { ExerciseGuide } from '../data/exerciseGuides';
import { useRepository } from '../hooks/useRepository';
import { askCoach, describeExercise, getApiKey, suggestedQuestions, type ChatTurn } from '../lib/aiCoach';
import { errorMessage } from '../lib/errors';
import { exerciseHistory } from '../lib/exerciseHistory';
import type { Exercise } from '../types/models';

/** 動作教學最下面的「問 AI 教練」：可以接著追問，關掉教學頁就清空 */
export function ExerciseCoach({ exercise, guide, onClose }: { exercise: Exercise; guide: ExerciseGuide | undefined; onClose: () => void }) {
  const repo = useRepository();
  const [apiKey] = useState(getApiKey);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  const ask = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    const traits = repo.traitsOf(exercise.id);
    const context = describeExercise({
      exercise,
      guide,
      history: exerciseHistory(repo.getSessions(), exercise.id, traits),
      traits,
      unit: repo.getWeightUnit(),
    });
    const next: ChatTurn[] = [...turns, { role: 'user', text: q }];
    setTurns(next);
    setQuestion('');
    setAnswer('');
    setError('');
    setBusy(true);
    const controller = new AbortController();
    abort.current = controller;
    try {
      const full = await askCoach(apiKey, context, next, setAnswer, controller.signal);
      setTurns([...next, { role: 'assistant', text: full }]);
    } catch (err) {
      if (controller.signal.aborted) return;
      // 沒答完的問題拿掉，放回輸入框方便重問
      setTurns(turns);
      setQuestion(q);
      setError(errorMessage(err));
    } finally {
      setAnswer('');
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  const goSettings = () => {
    onClose();
    location.hash = '#/settings';
  };

  return (
    <section class="guide-section coach">
      <h3>問 AI 教練</h3>
      {!apiKey ? (
        <p class="note">
          做這個動作時哪裡酸、哪裡卡住，都可以直接問 AI。需要先在設定填入你自己的 Anthropic API 金鑰。{' '}
          <button type="button" class="btn-text" onClick={goSettings}>
            前往設定
          </button>
        </p>
      ) : (
        <>
          {turns.length === 0 && !busy && (
            <div class="chips chips-wrap coach-suggestions">
              {suggestedQuestions(exercise).map((s) => (
                <button key={s} type="button" class="chip coach-chip" onClick={() => void ask(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}

          {turns.length > 0 && (
            <div class="coach-thread" aria-live="polite">
              {turns.map((t, i) => (
                <p key={i} class={t.role === 'user' ? 'coach-q' : 'coach-a'}>
                  {t.text}
                </p>
              ))}
              {busy && <p class="coach-a">{answer || <span class="muted">思考中…</span>}</p>}
            </div>
          )}

          {error && (
            <p class="note note-warn" role="alert">
              {error}
            </p>
          )}

          <form
            class="coach-form"
            onSubmit={(e) => {
              e.preventDefault();
              void ask(question);
            }}
          >
            <textarea
              class="input textarea"
              rows={2}
              maxLength={500}
              placeholder={turns.length > 0 ? '繼續追問…' : `例如：${exercise.name}做完肩膀很酸，三頭比胸先沒力`}
              value={question}
              onInput={(e) => setQuestion(e.currentTarget.value)}
              disabled={busy}
              aria-label="要問 AI 教練的問題"
            />
            <button type="submit" class="btn btn-primary btn-sm" disabled={busy || !question.trim()}>
              {busy ? '回答中…' : '發問'}
            </button>
          </form>
          <p class="muted small-text">AI 的建議僅供參考；疼痛、麻或受傷請找醫師或物理治療師。</p>
        </>
      )}
    </section>
  );
}
