# 訓練紀錄

手機優先的健身訓練紀錄網頁 App。資料只存在瀏覽器裡（IndexedDB；瀏覽器不支援時改用 localStorage），不需要後端。

主要功能：菜單輪替（依上次練的日期建議今天練哪份菜單）、Google Drive 自動雲端備份、訓練日曆與連續訓練週數、每週各部位組數目標、單一動作完整歷史、用飲食與體重紀錄推算實際 TDEE、體態照片前後對比、訓練紀錄與休息計時（可依動作設定）、菜單範本、超級組、動作備註、訓練時長、訓練中即時提示破紀錄與加重建議、公斤／磅切換、138 個動作的教學與假人示範、PR 與 1RM 趨勢、體態追蹤、飲食與熱量（TDEE、增肌減脂建議攝取量、拍照記錄每餐）、槓片／1RM 計算、練前熱身與練後拉伸引導。

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

## Google Drive 雲端備份

連線後，每次新增或修改紀錄都會自動把完整備份上傳到你的 Google Drive。備份放在 App 專用的隱藏資料夾（`appDataFolder`），App 只拿得到這個資料夾，看不到你 Drive 裡的其他檔案。換手機時，在新手機連線同一個 Google 帳號就能一鍵還原。飲食照片不在雲端備份裡。

### 第一次設定：建立 Google OAuth 用戶端 ID（約 10 分鐘，只要做一次）

這是純前端 App，需要一個你自己的 Google「OAuth 用戶端 ID」才能登入 Google。用戶端 ID 是公開資訊（會出現在網頁裡），不是密碼。Google Cloud 主控台的選單名稱偶爾會改，找不到時用上方的搜尋列搜尋關鍵字。

1. 到 [Google Cloud 主控台](https://console.cloud.google.com/)，建立一個新專案（名稱例如 `fitness-log`）。
2. 搜尋「Google Drive API」，按「啟用」。
3. 搜尋「OAuth 同意畫面」（新版叫「Google Auth Platform」），按「開始」：
   - 應用程式名稱：例如「訓練紀錄」；使用者支援電子郵件：選你的 Gmail
   - 目標對象：選「外部」
   - 聯絡資訊：填你的 Gmail，同意政策後建立
4. 在「目標對象」頁的「測試使用者」加入你自己的 Gmail（App 維持「測試中」狀態即可，只有這裡列出的帳號能登入）。
5. 在「資料存取」頁按「新增或移除範圍」，手動加入 `https://www.googleapis.com/auth/drive.appdata`，儲存。
6. 在「用戶端」（或「憑證」）頁建立 OAuth 用戶端 ID：
   - 應用程式類型：「網頁應用程式」
   - 已授權的 JavaScript 來源：`https://<你的 GitHub 帳號小寫>.github.io`（例如 `https://jack-lin625.github.io`）；要在電腦上測試的話，再加 `http://localhost:5173` 和 `http://localhost:4173`
   - 「已授權的重新導向 URI」留空
7. 複製建立好的用戶端 ID（長得像 `123456-abc.apps.googleusercontent.com`）。
8. 到 GitHub repo 的 **Settings → Secrets and variables → Actions → Variables** 分頁，按「New repository variable」：名稱 `GOOGLE_CLIENT_ID`，值貼上用戶端 ID。
9. 到 **Actions** 分頁，選「部署到 GitHub Pages」→「Run workflow」重新部署。完成後，App 的「設定 → Google Drive 雲端備份」就會出現「連線 Google Drive」按鈕。

在電腦上開發時，在專案根目錄建立 `.env.local`（不會被上傳到 GitHub），內容：`VITE_GOOGLE_CLIENT_ID=你的用戶端 ID`。

### 使用方式與限制

- Google 給純前端 App 的授權大約 1 小時有效，而且不能在背景自動續期（重新取得授權一定要由使用者按按鈕開啟 Google 視窗）。所以按「完成」結束訓練時，會順便重新取得授權（已授權過的帳號，Google 視窗會自動關閉），練完就會自動備份。其他時候過期了又有新的紀錄，紀錄頁會出現「有變更還沒備份到 Google Drive」，按「上傳」就會繼續。
- 上傳前一定先檢查雲端：新手機（沒有資料）不會用空白資料蓋掉雲端，會問你要不要還原；雲端的備份如果是別台手機上傳的，會暫停自動備份，讓你選要保留哪一份。
- 這是「自動備份」，不是多台裝置同時使用的雙向同步：同一時間請以一支手機為主。
- 加到 iPhone 主畫面的 App 開啟 Google 登入視窗時，若一直無法完成，請先用 Safari 開啟網站連線一次。

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
- 刪除訓練、範本、飲食、體態紀錄、自訂動作時不先跳確認，而是刪除後顯示「復原」按鈕 6 秒（`actions/undo.ts`）；飲食照片等到確定不復原才真的刪掉。
- 動作教學與假人動畫（`ExerciseGuideSheet` 及其資料）拆成獨立的檔案，打開教學時才下載（App 空閒時也會先在背景下載），讓第一次開啟 App 更快。
- 某個畫面出錯時只會換成錯誤說明（`components/ErrorBoundary.tsx`），並提供「下載完整備份」，不會整個 App 白屏。

### 動作教學與假人示範

- 138 個內建動作都有教學（準備姿勢、步驟、重點、常見錯誤與修正、呼吸、安全），依部位分檔放在 `src/data/guides/`。新增內建動作時，測試會要求一併寫好教學。
- 138 個內建動作都有假人示範（`src/demos/`，依部位分檔）。大部分用側面呈現；側平舉、飛鳥、髖外展這類往身體兩側的動作用正面（啞鈴飛鳥用俯視）呈現。器材（啞鈴、繩索與滑輪、機器、訓練椅、單槓）也一起畫出來。
- 身體角度由力學限制算出：例如深蹲時重量維持在腳掌中心上方（所以前蹲比背蹲直立）、臥推推到頂端時手在肩膀正上方、彎舉時上臂不動。測試會逐格檢查：骨頭長度固定、整個人和器材在畫面內、腳底貼地，以及上述的力學限制；新增內建動作時，測試會要求一併加上示範。

### 飲食與照片

- TDEE：基礎代謝預設用 Mifflin-St Jeor，有 60 天內的體脂率時改用 Katch-McArdle；乘上活動係數得到 TDEE。減脂 −20%（不低於基礎代謝）、維持、增肌 +10%。蛋白質依體重（減脂 2.0、維持 1.6、增肌 1.8 g/kg），脂肪約 25% 熱量，其餘為碳水（`lib/nutrition.ts`）。
- 體重、體脂率直接取自體態紀錄；在 TDEE 設定改體重，會記到當天的體態紀錄。
- 實際 TDEE 推算（`lib/adaptiveTdee.ts`）：到昨天為止的 28 天內，至少 20 天有記錄飲食（一天低於 800 kcal 視為只記了一部分，不採用）、至少 6 次體重且跨越 14 天以上時，用「平均每日攝取 − 體重趨勢（線性回歸）× 7,700 kcal/kg」推算。使用者在飲食頁選擇採用後，每日目標改用這個數字計算。
- 照片拍完先縮到長邊 1280px 的 JPEG（約 150–300 KB），存在 IndexedDB（`data/photoStore.ts`），飲食紀錄只記照片 id。
- 體態紀錄可以附正面、側面、背面三張照片（資料格式 v6），體態頁可以選兩天並排比較。照片和飲食照片存在同一個地方。
- 照片（飲食、體態）不在「下載完整備份」和雲端備份裡，在設定頁另外「下載所有照片」。換手機時先匯入完整備份，再匯入照片備份。

### 離線快取的更新方式

每次 `npm run build` 都會依檔案內容算出新的版本號。使用者下次開啟 App 時，新版 Service Worker 會先在背景下載整個新版本（包含圖表程式和字型），下載完成才啟用並刪除舊版快取。因此：

- 第一次開啟後，即使從沒進過圖表頁，離線時也能開。
- 快取永遠只有一個版本，不會隨著部署次數越來越大。
- 內容沒變就重新建置，版本號也不變，使用者不用重新下載。
