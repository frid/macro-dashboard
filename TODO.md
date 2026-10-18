# 規則
1. 用 Check item，每個 Task 用兩個字母＋兩個數字編號（Ex: DA-01）。前綴：SU 專案設定、DA 資料、UI 畫面、DC 文件。
2. 子 Task 用 (a, b, c, … 等編碼並縮排)，Ex: DA-01a, DA-01b。
3. 每次變更前，先掃描有無新增沒編碼的，自動編碼（沿用同一節前綴，取最大號＋1，用過的號碼不重用）。
4. 狀態：`[ ]` 未開始、`[~]` 進行中、`[x]` 完成（行尾加「（完成 YYYY-MM-DD）」）。完成項移到 `## Complete`。
5. 講義頁碼寫 `[K 頁碼]`（整份 193 頁的頁碼；1-1 檔 = 1–128，1-2 檔 = 129–193）。

# 專案設定

# 資料
- [ ] DA-02 抓資料腳本 `tools/fetch-data.mjs`（Node 24、零套件）：從 FRED 公開 CSV 抓序列 → `data/series/<ID>.json`；含 NBER 衰退期 `USREC`
- [ ] DA-03 GitHub Actions 排程（每日）跑 DA-02 並 commit 資料（依賴 SU-01）
- [ ] DA-04 非 FRED 指標處理：ISM 製造業／服務業 PMI、Conference Board CCI、BDI、ICE 美元指數、LME 庫存、黃金、EIA 原油庫存
  - 要你決定：用替代序列（見指標清單「替代」欄）、手動維護 CSV，或先不做
- [ ] DA-05 衍生指標計算：NFP 月增減、Sahm Rule（自算對照 `SAHMREALTIME`）、CPI／PCE／PPI 年增率、BBB−AAA 利差、赤字占 GDP、Beveridge 曲線資料對
- [ ] DA-06 台灣指標是否納入（國發會景氣對策信號、台灣 PMI 等）
  - SU-03 確認講義沒有台灣指標；要你決定：要不要當延伸功能加進來（建議放在 1.0 之後）
- [ ] DA-07 G 區債務圖組：抓 `GFDEBTN`、`HMLBSHNO`、`MABSHNO`、`CMLBSHNO`、`SLOASM`、`REVOLSL`、`MVLOASM`、`GDP`，算 YoY 與占 GDP 比 [K 69–91]

# 畫面
- [ ] UI-01 版面骨架：頁首、六大分類分區（C／I／G／NX／MC／IFU）、指標卡片（名稱、最新值、較前期變動、迷你走勢、領先／同時／落後標籤、資料日期）
- [ ] UI-02 指標詳細圖：點卡片展開，照講義格式「原值＋3 月均（QMA）＋12 月均（YMA）＋NBER 衰退陰影」，下方配 YoY 圖；門檻線（PMI 50、Sahm 0.5、Philly Fed 0、期限利差 0、債務 YoY 3%、損益兩平通膨 2%、VIX 12／20／30、YoY 0 線）；支援雙軸對照（如初領 vs 續領）
- [ ] UI-03 綜合訊號總覽：依講義「越多指標指向同方向越可信」[K 4]，列出各指標目前偏擴張／偏收縮的燈號與統計
- [ ] UI-04 特殊圖：Beveridge 曲線（失業率 × 職缺率散佈）、殖利率曲線利差、Sahm Rule
- [ ] UI-05 公布行事曆：各指標下次公布時間（依講義公布規則）
- [ ] UI-06 頁尾：資料來源與講義出處聲明、版號（讀 `VERSION`）、最後更新日期
- [ ] UI-07 深色／淺色主題、手機版版面
- [ ] UI-08 Indicator 要顯示更日期、預估下次更新日期、與還有幾天 (有顏色表示)。注意時區 (台灣跟美國時差)
- [ ] UI-09 版權說明：資料來源（FRED 等各序列來源與使用條款）、講義出處（郭維裕《Fantastic Economic Indicators》，內容為自行摘要）、製作者；放頁尾或獨立「關於」區塊（可與 UI-06 合併做）
  - 要你決定：製作者署名寫法（姓名／EMBA 班別／聯絡方式）、是否加授權聲明（如程式 MIT、內容僅供課堂學習）

# 文件
- [ ] DC-01 README：用途、線上網址、資料來源、如何本機更新資料
- [ ] DC-02 操作手冊 `manual.html`（文字配合截圖，後期）

## Complete
- [x] DA-01 指標目錄 `data/indicators.json`：32 個指標（C 7／I 6／G 2／NX 3／MC 6／IFU 8）＋NBER 衰退期 `USREC`，格式定案寫入 `doc/decisions/SU-02-技術選型.md`（完成 2026-10-18）
- [x] SU-02 技術選型定案：單檔 `index.html`＋`data/*.json`，圖表庫 Apache ECharts 6.1.0（cdnjs＋SRI），決策紀錄 `doc/decisions/SU-02-技術選型.md`（完成 2026-10-18）
- [x] SU-01 建立 GitHub repo 與 GitHub Pages 部署：公開 repo `frid/macro-dashboard`，Pages 從 `main` 根目錄發佈 <https://frid.github.io/macro-dashboard/>（完成 2026-10-18）
- [x] SU-03 講義圖片頁整理（約 115 頁圖表），寫成 `doc/reference/郭維裕講義-圖表頁摘要.md`，並回填 `doc/reference/指標清單.md`（完成 2026-10-18）
- [x] SU-00 建立專案管理檔案：CLAUDE.md、TODO.md、VERSION、CHANGELOG.md、README.md、.gitignore、task-next／task-release skills、worker／verifier agents、指標清單（完成 2026-10-18）
