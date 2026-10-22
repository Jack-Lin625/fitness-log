import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';

// GitHub Pages 會把網站放在 https://<帳號>.github.io/<repo名稱>/
// 若 repo 名稱不是 fitness-log，請修改下面這行。
// 開發與預覽時網址同樣是 http://localhost:5173/fitness-log/，和正式環境一致。
const REPO_NAME = 'fitness-log';

/**
 * 建置完成後，把「這一版的所有檔案」與版本號寫進 dist/sw.js，
 * 讓 Service Worker 安裝時就能下載齊全，並在下一版啟用時清掉舊快取。
 */
function serviceWorkerPrecache(): Plugin {
  let publicDir = '';
  return {
    name: 'fitlog-sw-precache',
    apply: 'build',
    configResolved(config) {
      publicDir = config.publicDir;
    },
    writeBundle(options, bundle) {
      const outDir = options.dir;
      if (!outDir) return;
      const hash = createHash('sha256');
      const files: string[] = [];

      for (const [fileName, item] of Object.entries(bundle).sort(([a], [b]) => a.localeCompare(b))) {
        if (fileName.endsWith('.map')) continue;
        // 首頁以 App 的根網址快取（瀏覽器開啟時請求的是 /<repo>/，不是 /<repo>/index.html）
        files.push(fileName === 'index.html' ? './' : fileName);
        hash.update(fileName).update(item.type === 'chunk' ? item.code : item.source);
      }
      for (const fileName of readdirSync(publicDir).sort()) {
        if (fileName === 'sw.js') continue;
        files.push(fileName);
        hash.update(fileName).update(readFileSync(join(publicDir, fileName)));
      }

      const swPath = join(outDir, 'sw.js');
      const template = readFileSync(swPath, 'utf8');
      const version = hash.update(template).digest('hex').slice(0, 12);
      const withVersion = template.replace("const VERSION = 'dev';", `const VERSION = '${version}';`);
      const output = withVersion.replace('/*__PRECACHE__*/ []', JSON.stringify(files));
      if (withVersion === template || output === withVersion) {
        throw new Error('public/sw.js 裡找不到版本號或檔案清單的位置，Service Worker 無法更新');
      }
      writeFileSync(swPath, output);
    },
  };
}

export default defineConfig({
  base: `/${REPO_NAME}/`,
  plugins: [preact(), serviceWorkerPrecache()],
});
