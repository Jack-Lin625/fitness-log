import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
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

/** 動作檢查用的 MediaPipe 分析程式（wasm） */
const MEDIAPIPE_DIR = 'node_modules/@mediapipe/tasks-vision/wasm';
const MEDIAPIPE_VERSION: string = JSON.parse(
  readFileSync('node_modules/@mediapipe/tasks-vision/package.json', 'utf8'),
).version;
const MEDIAPIPE_FILES = [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
];

/**
 * 把 MediaPipe 的 wasm 放到網站的 mediapipe/<版本>/ 底下（不放進 public，避免 Service Worker 預先下載 26 MB）。
 * 開發時直接從 node_modules 提供。
 */
function mediapipeWasm(): Plugin {
  const prefix = `/${REPO_NAME}/mediapipe/${MEDIAPIPE_VERSION}/`;
  return {
    name: 'fitlog-mediapipe-wasm',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const name = req.url?.startsWith(prefix) ? req.url.slice(prefix.length).split('?')[0] : undefined;
        if (!name || !MEDIAPIPE_FILES.includes(name)) return next();
        res.setHeader('Content-Type', name.endsWith('.wasm') ? 'application/wasm' : 'text/javascript');
        res.end(readFileSync(join(MEDIAPIPE_DIR, name)));
      });
    },
    writeBundle(options) {
      if (!options.dir) return;
      const out = join(options.dir, 'mediapipe', MEDIAPIPE_VERSION);
      mkdirSync(out, { recursive: true });
      for (const name of MEDIAPIPE_FILES) copyFileSync(join(MEDIAPIPE_DIR, name), join(out, name));
    },
  };
}

export default defineConfig({
  base: `/${REPO_NAME}/`,
  define: { __MEDIAPIPE_VERSION__: JSON.stringify(MEDIAPIPE_VERSION) },
  plugins: [preact(), serviceWorkerPrecache(), mediapipeWasm()],
});
