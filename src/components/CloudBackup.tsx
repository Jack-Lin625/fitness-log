import { cloud, cloudTimeLabel } from '../actions/cloud';
import { hasValidToken } from '../lib/cloudSync';
import { errorMessage } from '../lib/errors';
import { GOOGLE_CLIENT_ID } from '../lib/googleAuth';
import { formatBytes } from '../lib/photos';
import { useStore } from '../lib/store';
import { showToast } from './Toast';

/** 執行使用者按下的雲端操作，失敗時跳出原因 */
const act = (fn: () => Promise<void>, done?: string) =>
  fn()
    .then(() => done && showToast(done))
    .catch((err: unknown) => showToast(errorMessage(err), 4000));

/** 雲端與這台資料不同（或新手機）時的選擇 */
function DecisionCard() {
  const { decision, busy } = useStore(cloud.store);
  if (!decision) return null;
  const when = cloudTimeLabel(decision.cloud.modifiedTime);
  return (
    <div class="cloud-card cloud-card-warn" role="alert">
      {decision.kind === 'restore' ? (
        <>
          <strong>Google Drive 裡有備份</strong>
          <p>
            {when} 的備份（{formatBytes(decision.cloud.size)}）。這支手機還沒有資料，要從雲端還原嗎？
          </p>
        </>
      ) : (
        <>
          <strong>Google Drive 的備份和這支手機不一樣</strong>
          <p>
            雲端的備份（{when}）不是這支手機上傳的，可能來自別的手機或重新安裝前。為了不蓋掉任何資料，自動備份先暫停，請選擇要保留哪一份：
          </p>
        </>
      )}
      <div class="button-pair">
        <button type="button" class="btn btn-primary btn-sm" disabled={busy !== null} onClick={() => act(() => cloud.resolve('useCloud'))}>
          用雲端的取代這支手機
        </button>
        {decision.kind === 'conflict' ? (
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            disabled={busy !== null}
            onClick={() => act(() => cloud.resolve('useLocal'), '已用這支手機的資料更新雲端備份')}
          >
            用這支手機覆蓋雲端
          </button>
        ) : (
          <button type="button" class="btn btn-secondary btn-sm" onClick={() => cloud.dismissDecision()}>
            先不要
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * 紀錄頁、訓練詳情頁上方的提示：有變更但授權過期（要按一下才能上傳）、需要選擇、上傳失敗。
 * 一切正常時不顯示。
 */
export function CloudBanner() {
  const { meta, busy, decision, error } = useStore(cloud.store);
  if (!meta.enabled) return null;
  if (decision) return <DecisionCard />;
  const needsTap = meta.dirty && !hasValidToken(meta);
  if (!needsTap && !error) return null;
  return (
    <div class={error ? 'cloud-card cloud-card-warn' : 'cloud-card'} role="status">
      <span>
        {busy === 'upload' ? '上傳到 Google Drive 中…' : error ? `雲端備份失敗：${error}` : '有變更還沒備份到 Google Drive'}
      </span>
      <button type="button" class="btn btn-secondary btn-sm" disabled={busy !== null} onClick={() => act(() => cloud.uploadNow(), '已備份到 Google Drive')}>
        {error ? '重試' : '上傳'}
      </button>
    </div>
  );
}

/** 設定頁：連線、狀態、立即上傳、從雲端還原、中斷連線 */
export function CloudBackupSection() {
  const { meta, busy, error } = useStore(cloud.store);

  return (
    <section class="section">
      <h2 class="section-title">Google Drive 雲端備份</h2>
      {!GOOGLE_CLIENT_ID ? (
        <p class="muted small-text">
          還沒有設定 Google 用戶端 ID，暫時無法使用。設定方法請看專案的 README「Google Drive 雲端備份」。
        </p>
      ) : !meta.enabled ? (
        <>
          <p class="muted small-text">
            連線後，每次新增或修改紀錄都會自動備份到你的 Google Drive（放在 App 專用的隱藏資料夾，看不到也不會動到你 Drive 裡的其他檔案）。換手機時登入同一個 Google 帳號就能還原。照片（飲食、體態）不在雲端備份裡。
          </p>
          <button type="button" class="btn btn-primary btn-block" disabled={busy !== null} onClick={() => act(() => cloud.connect())}>
            {busy === 'connect' ? '連線中…' : '連線 Google Drive'}
          </button>
        </>
      ) : (
        <>
          <DecisionCard />
          <dl class="kv">
            <dt>狀態</dt>
            <dd>
              {busy === 'upload'
                ? '上傳中…'
                : busy === 'restore'
                  ? '還原中…'
                  : meta.dirty
                    ? '有變更還沒上傳'
                    : '已是最新'}
            </dd>
            <dt>上次備份</dt>
            <dd>{meta.lastUploadAt ? cloudTimeLabel(meta.lastUploadAt) : '還沒有'}</dd>
          </dl>
          {error && <p class="note note-warn">{error}</p>}
          <p class="muted small-text">
            Google 的授權約 1 小時有效，過期後會在紀錄頁顯示「上傳」按鈕，按一下就會繼續備份。
          </p>
          <div class="action-stack">
            <button type="button" class="btn btn-primary btn-block" disabled={busy !== null} onClick={() => act(() => cloud.uploadNow(), '已備份到 Google Drive')}>
              立即備份
            </button>
            <button type="button" class="btn btn-secondary btn-block" disabled={busy !== null} onClick={() => act(() => cloud.restoreFromCloud())}>
              從 Google Drive 還原
            </button>
            <button
              type="button"
              class="btn btn-danger-text btn-block"
              disabled={busy !== null}
              onClick={() => act(() => cloud.disconnect(), '已中斷連線，雲端的備份檔仍保留')}
            >
              中斷連線
            </button>
          </div>
        </>
      )}
    </section>
  );
}
