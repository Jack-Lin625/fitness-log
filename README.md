# 訓練紀錄

手機優先的健身訓練紀錄網頁 App。資料只存在瀏覽器的 localStorage，不需要後端。

## 在電腦上開發

```bash
npm install
npm run dev        # 開啟 http://localhost:5173/fitness-log/
npm run build      # 型別檢查 + 建置到 dist/
npm run preview    # 預覽建置結果（會啟用離線快取）
npm test           # 執行所有測試
npm run test:watch # 邊改邊測：存檔時自動重跑相關測試
```

測試用 Vitest，檔案放在被測程式旁邊（`src/**/*.test.ts`）；Service Worker 的測試在 `tests/`，會實際建置一次再模擬離線情境。推送到 GitHub 時會先跑測試，沒過就不會部署。

用手機測試：`npm run dev -- --host`，再用手機開啟終端機顯示的 Network 網址（手機與電腦要連同一個 Wi-Fi）。

## 部署到 GitHub Pages

1. 在 GitHub 建立一個**公開（Public）**的 repo，名稱用 `fitness-log`。
   - 若用別的名稱，請修改 `vite.config.ts` 裡的 `REPO_NAME`。
2. 把專案上傳到 repo 的 `main` 分支。**不要上傳 `node_modules` 和 `dist` 資料夾**（`.gitignore` 已設定排除）。
3. 到 repo 的 **Settings → Pages**，**Source** 選 **GitHub Actions**。
4. 到 **Actions** 分頁，等「部署到 GitHub Pages」出現綠色勾勾（約 1–2 分鐘）。
5. 網址：`https://<你的 GitHub 帳號>.github.io/fitness-log/`

之後每次把修改推送到 `main`，都會自動重新部署。

## 加到手機主畫面

- **iPhone（Safari）**：分享按鈕 → 加入主畫面
- **Android（Chrome）**：右上角 ⋮ → 加到主畫面／安裝應用程式

加到主畫面後會以全螢幕開啟，第一次開啟後即使沒有網路也能使用。

> iPhone 注意：Safari 會清除「超過 7 天沒開啟的網站」的資料，但加到主畫面的 App 不受此限制。請務必加到主畫面，並定期在「設定」下載備份。從主畫面開啟時，下載備份會跳出分享選單，選「儲存到檔案」或傳到雲端即可。

## 程式架構

| 位置 | 內容 |
|---|---|
| `src/types/models.ts` | 資料模型與版本號 |
| `src/data/` | 資料存取層，UI 只透過 `repo`（`data/index.ts`）讀寫 |
| `src/lib/` | 純計算函式（1RM、容量、槓片、PR、移動平均、匯出） |
| `src/actions/` | 跨頁面共用的操作流程（開始／複製／刪除訓練） |
| `src/components/`、`src/pages/` | 畫面 |
| `public/sw.js` | 離線快取；`npm run build` 時由 `vite.config.ts` 填入版本號與檔案清單 |

- 換儲存後端（IndexedDB、雲端）：實作 `StorageAdapter`，在 `data/index.ts` 替換。
- 改資料格式：遞增 `CURRENT_DATA_VERSION`，在 `data/migrations.ts` 加升級函式；舊資料與舊備份會自動升級。
- 讀取資料（啟動、匯入備份）時，`data/migrations.ts` 會逐項檢查格式：認不得的器材、肌群、錯誤型別的設定值會換成預設值，結構壞掉的訓練草稿會捨棄，避免畫面出錯。
- 匯入備份或讀取失敗前，會在瀏覽器裡自動另存一份原始資料，最多保留最新 3 份（內容相同不重複存），避免備份塞滿儲存空間。
- 某個畫面出錯時只會換成錯誤說明（`components/ErrorBoundary.tsx`），並提供「下載完整備份」，不會整個 App 白屏。

### 離線快取的更新方式

每次 `npm run build` 都會依檔案內容算出新的版本號。使用者下次開啟 App 時，新版 Service Worker 會先在背景下載整個新版本（包含圖表程式和字型），下載完成才啟用並刪除舊版快取。因此：

- 第一次開啟後，即使從沒進過圖表頁，離線時也能開。
- 快取永遠只有一個版本，不會隨著部署次數越來越大。
- 內容沒變就重新建置，版本號也不變，使用者不用重新下載。
