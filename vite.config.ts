import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// GitHub Pages 會把網站放在 https://<帳號>.github.io/<repo名稱>/
// 若 repo 名稱不是 fitness-log，請修改下面這行。
// 開發與預覽時網址同樣是 http://localhost:5173/fitness-log/，和正式環境一致。
const REPO_NAME = 'fitness-log';

export default defineConfig({
  base: `/${REPO_NAME}/`,
  plugins: [preact()],
});
