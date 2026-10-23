/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Google OAuth 用戶端 ID（雲端備份用），沒設定時雲端備份功能不會顯示連線按鈕 */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
