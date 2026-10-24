import { useState } from 'preact/hooks';
import { getApiKey, looksLikeApiKey, maskApiKey, setApiKey } from '../lib/aiCoach';
import { errorMessage } from '../lib/errors';
import { showToast } from './Toast';

/** 設定頁：AI 教練用的 Anthropic API 金鑰（只存在這台裝置，不會進備份） */
export function CoachSettings() {
  const [saved, setSaved] = useState(getApiKey);
  const [draft, setDraft] = useState('');

  const save = () => {
    const key = draft.trim();
    if (!looksLikeApiKey(key)) {
      showToast('金鑰格式不對，應該是 sk-ant- 開頭的一長串文字');
      return;
    }
    try {
      setApiKey(key);
      setSaved(key);
      setDraft('');
      showToast('已儲存，打開任一動作的教學就能發問');
    } catch (err) {
      showToast(errorMessage(err));
    }
  };

  const remove = () => {
    try {
      setApiKey('');
      setSaved('');
      showToast('已刪除金鑰');
    } catch (err) {
      showToast(errorMessage(err));
    }
  };

  return (
    <section class="section">
      <h2 class="section-title">AI 教練</h2>
      <div class="coach-settings">
        <p class="muted small-text">
          在每個動作的教學頁最下面，可以問 AI 做動作時遇到的問題（例如「臥推肩膀很酸」）。回答由 Anthropic 的 Claude
          提供，需要你自己的 API 金鑰，依用量付費（一題大約台幣 1 元以內）。
        </p>
        {saved ? (
          <div class="custom-row">
            <span>
              已設定 <span class="num muted">{maskApiKey(saved)}</span>
            </span>
            <button type="button" class="btn btn-danger-text btn-sm" onClick={remove}>
              刪除金鑰
            </button>
          </div>
        ) : (
          <>
            <ol class="small-text coach-steps">
              <li>
                到{' '}
                <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
                  Anthropic 主控台
                </a>{' '}
                註冊、儲值，建立一把 API 金鑰
              </li>
              <li>複製金鑰貼到下面，按「儲存」</li>
            </ol>
            <form
              class="input-with-action"
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
            >
              <input
                class="input"
                type="password"
                autocomplete="off"
                spellcheck={false}
                placeholder="sk-ant-…"
                value={draft}
                onInput={(e) => setDraft(e.currentTarget.value)}
                aria-label="Anthropic API 金鑰"
              />
              <button type="submit" class="btn btn-primary btn-sm" disabled={!draft.trim()}>
                儲存
              </button>
            </form>
          </>
        )}
        <p class="muted small-text">
          金鑰只存在這台裝置的瀏覽器裡，不會放進備份檔或 Google Drive；發問時會把問題、這個動作的教學和你最近幾次的紀錄傳給
          Anthropic。換手機要重新貼一次。
        </p>
      </div>
    </section>
  );
}
