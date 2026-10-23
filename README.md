# 訓練紀錄

手機優先的健身訓練紀錄網頁 App。資料只存在瀏覽器裡（IndexedDB；瀏覽器不支援時改用 localStorage），不需要後端。

主要功能：訓練紀錄與休息計時（可依動作設定）、菜單範本、超級組、動作備註、訓練時長、訓練中即時提示破紀錄與加重建議、公斤／磅切換、138 個動作的教學與假人示範、PR 與 1RM 趨勢、體態追蹤、飲食與熱量（TDEE、增肌減脂建議攝取量、拍照記錄每餐）、槓片／1RM 計算、練前熱身與練後拉伸引導。

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
| `src/lib/` | 純計算函式（1RM、容量、槓片、PR、移動平均、TDEE、照片壓縮、匯出） |
| `src/actions/` | 跨頁面共用的操作流程（開始／複製／刪除訓練） |
| `src/components/`、`src/pages/` | 畫面 |
| `public/sw.js` | 離線快取；`npm run build` 時由 `vite.config.ts` 填入版本號與檔案清單 |

- 儲存：預設用 `data/indexedDbAdapter.ts`（主資料、訓練草稿、本機備份各存一筆）。舊版存在 localStorage 的資料，第一次開啟時會自動搬進 IndexedDB。訓練中的自動暫存只寫草稿，不會每次重寫全部紀錄。
- 換儲存後端（雲端等）：實作 `StorageAdapter`，在 `data/index.ts` 替換。
- 重量一律以公斤儲存；選了磅只在輸入與顯示時換算（`lib/units.ts`）。
- 改資料格式：遞增 `CURRENT_DATA_VERSION`，在 `data/migrations.ts` 加升級函式；舊資料與舊備份會自動升級。
- 讀取資料（啟動、匯入備份）時，`data/migrations.ts` 會逐項檢查格式：認不得的器材、肌群、錯誤型別的設定值會換成預設值，結構壞掉的訓練草稿會捨棄，避免畫面出錯。
- 匯入備份或讀取失敗前，會在瀏覽器裡自動另存一份原始資料，最多保留最新 3 份（內容相同不重複存），避免備份塞滿儲存空間。
- 某個畫面出錯時只會換成錯誤說明（`components/ErrorBoundary.tsx`），並提供「下載完整備份」，不會整個 App 白屏。

### 動作教學與假人示範

- 138 個內建動作都有教學（準備姿勢、步驟、重點、常見錯誤與修正、呼吸、安全），依部位分檔放在 `src/data/guides/`。新增內建動作時，測試會要求一併寫好教學。
- 假人示範（`src/demos/`）目前有深蹲、硬舉、羅馬尼亞硬舉、槓鈴划船、肩推、臥推、臀推。身體角度由力學限制算出（例如槓鈴維持在腳掌中心上方、骨頭長度固定），測試會逐格檢查這些限制。

### 飲食與照片

- TDEE：基礎代謝預設用 Mifflin-St Jeor，有 60 天內的體脂率時改用 Katch-McArdle；乘上活動係數得到 TDEE。減脂 −20%（不低於基礎代謝）、維持、增肌 +10%。蛋白質依體重（減脂 2.0、維持 1.6、增肌 1.8 g/kg），脂肪約 25% 熱量，其餘為碳水（`lib/nutrition.ts`）。
- 體重、體脂率直接取自體態紀錄；在 TDEE 設定改體重，會記到當天的體態紀錄。
- 照片拍完先縮到長邊 1280px 的 JPEG（約 150–300 KB），存在 IndexedDB（`data/photoStore.ts`），飲食紀錄只記照片 id。
- 照片不在「下載完整備份」裡，在設定頁另外「下載所有照片」。換手機時先匯入完整備份，再匯入照片備份。

### 離線快取的更新方式

每次 `npm run build` 都會依檔案內容算出新的版本號。使用者下次開啟 App 時，新版 Service Worker 會先在背景下載整個新版本（包含圖表程式和字型），下載完成才啟用並刪除舊版快取。因此：

- 第一次開啟後，即使從沒進過圖表頁，離線時也能開。
- 快取永遠只有一個版本，不會隨著部署次數越來越大。
- 內容沒變就重新建置，版本號也不變，使用者不用重新下載。
