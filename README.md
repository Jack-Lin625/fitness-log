# 訓練紀錄

手機優先的健身訓練紀錄網頁 App。資料只存在瀏覽器的 localStorage，不需要後端。

## 在電腦上開發

```bash
npm install
npm run dev        # 開啟 http://localhost:5173/fitness-log/
npm run build      # 型別檢查 + 建置到 dist/
npm run preview    # 預覽建置結果（會啟用離線快取）
```

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

> iPhone 注意：Safari 會清除「超過 7 天沒開啟的網站」的資料，但加到主畫面的 App 不受此限制。請務必加到主畫面，並定期在「設定」下載備份。

## 程式架構

| 位置 | 內容 |
|---|---|
| `src/types/models.ts` | 資料模型與版本號 |
| `src/data/` | 資料存取層，UI 只透過 `repo`（`data/index.ts`）讀寫 |
| `src/lib/` | 純計算函式（1RM、容量、槓片、PR、移動平均、匯出） |
| `src/actions/` | 跨頁面共用的操作流程（開始／複製／刪除訓練） |
| `src/components/`、`src/pages/` | 畫面 |
| `public/sw.js` | 離線快取 |

- 換儲存後端（IndexedDB、雲端）：實作 `StorageAdapter`，在 `data/index.ts` 替換。
- 改資料格式：遞增 `CURRENT_DATA_VERSION`，在 `data/migrations.ts` 加升級函式；舊資料與舊備份會自動升級。
