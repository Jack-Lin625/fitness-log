/**
 * Google 帳號授權（Google Identity Services 的 token client）
 *
 * 這是純前端 App，沒有後端可以保存長期憑證，所以只能拿到約 1 小時有效的存取權杖：
 * 過期後要使用者按一下按鈕重新取得（已授權過的帳號會自動關閉彈出視窗，不必再按同意）。
 * Google 的程式只在使用者要連線時才載入，不影響離線使用。
 */

/** 只要求 App 專用隱藏資料夾的權限：看不到使用者 Drive 裡的其他檔案 */
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

const GIS_SRC = 'https://accounts.google.com/gsi/client';

/** 建置時設定的 OAuth 用戶端 ID（GitHub repo 的 Variables：GOOGLE_CLIENT_ID） */
export const GOOGLE_CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';

export interface AccessToken {
  token: string;
  /** 到期時間（timestamp） */
  expiresAt: number;
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

interface TokenClient {
  requestAccessToken(overrides?: { prompt?: string }): void;
}

interface GoogleOAuth2 {
  initTokenClient(config: {
    client_id: string;
    scope: string;
    callback: (res: TokenResponse) => void;
    error_callback?: (err: { type?: string; message?: string }) => void;
  }): TokenClient;
  hasGrantedAllScopes(res: TokenResponse, scope: string): boolean;
  revoke(token: string, done?: () => void): void;
}

declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GoogleOAuth2 } };
  }
}

let loading: Promise<GoogleOAuth2> | null = null;

/** 載入 Google 的授權程式（只載一次） */
function loadGis(): Promise<GoogleOAuth2> {
  loading ??= new Promise<GoogleOAuth2>((resolve, reject) => {
    const ready = () => {
      const oauth2 = window.google?.accounts?.oauth2;
      if (oauth2) resolve(oauth2);
      else reject(new Error('Google 登入程式載入失敗'));
    };
    if (window.google?.accounts?.oauth2) return ready();
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.onload = ready;
    script.onerror = () => reject(new Error('連不上 Google，請確認網路'));
    document.head.appendChild(script);
  }).catch((err: unknown) => {
    loading = null; // 下次再試
    throw err;
  });
  return loading;
}

/**
 * 取得存取權杖（會開啟 Google 的彈出視窗，必須在使用者按按鈕時呼叫，否則會被瀏覽器擋下）。
 * firstTime：第一次連線要顯示帳號選擇與同意畫面；之後用空白 prompt，已授權就自動關閉。
 */
export async function requestAccessToken(firstTime: boolean): Promise<AccessToken> {
  if (!GOOGLE_CLIENT_ID) throw new Error('還沒有設定 Google 用戶端 ID');
  const oauth2 = await loadGis();
  return new Promise<AccessToken>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: DRIVE_SCOPE,
      callback: (res) => {
        if (res.error || !res.access_token) {
          return reject(new Error(res.error === 'access_denied' ? '沒有授權 Google Drive' : 'Google 授權失敗'));
        }
        if (!oauth2.hasGrantedAllScopes(res, DRIVE_SCOPE)) {
          return reject(new Error('需要勾選「Google Drive 中的應用程式資料」權限才能備份'));
        }
        // 提早 1 分鐘視為過期，避免上傳到一半失效
        resolve({ token: res.access_token, expiresAt: Date.now() + ((res.expires_in ?? 3600) - 60) * 1000 });
      },
      error_callback: (err) => {
        reject(new Error(err.type === 'popup_closed' ? '已取消 Google 登入' : '無法開啟 Google 登入視窗，請允許彈出視窗'));
      },
    });
    client.requestAccessToken({ prompt: firstTime ? 'consent' : '' });
  });
}

/** 撤銷授權（中斷連線時） */
export async function revokeAccess(token: string): Promise<void> {
  const oauth2 = await loadGis().catch(() => null);
  await new Promise<void>((resolve) => (oauth2 ? oauth2.revoke(token, resolve) : resolve()));
}
