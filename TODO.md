# 規則
1. 用 Check item，每個 Task 用兩個字母＋兩個數字編號（Ex: DA-01）。前綴：SU 專案設定、DA 資料、UI 畫面、DC 文件。
2. 子 Task 用 (a, b, c, … 等編碼並縮排)，Ex: DA-01a, DA-01b。
3. 每次變更前，先掃描有無新增沒編碼的，自動編碼（沿用同一節前綴，取最大號＋1，用過的號碼不重用）。
4. 狀態：`[ ]` 未開始、`[~]` 進行中、`[x]` 完成（行尾加「（完成 YYYY-MM-DD）」）。完成項移到 `## Complete`。
5. 講義頁碼寫 `[K 頁碼]`（整份 193 頁的頁碼；1-1 檔 = 1–128，1-2 檔 = 129–193）。

# 專案設定

# 資料
- [ ] DA-03 GitHub Actions 排程（每日）跑 DA-02 並 commit 資料（依賴 SU-01）
  - DA-04 起含 TradingView WebSocket 來源：要實測雲端 IP 能否連線；不行就在 Actions 跳過該來源、保留舊檔
- [ ] DA-06 台灣指標是否納入（國發會景氣對策信號、台灣 PMI 等）
  - SU-03 確認講義沒有台灣指標；要你決定：要不要當延伸功能加進來（建議放在 1.0 之後）
- [ ] DA-07 G 區債務圖組：抓 `GFDEBTN`、`HMLBSHNO`、`MABSHNO`、`CMLBSHNO`、`SLOASM`、`REVOLSL`、`MVLOASM`、`GDP`，算 YoY 與占 GDP 比 [K 69–91]
- [ ] DA-08 序列 title 修正：對照／組成序列（如 DGS10 掛在 Fed Funds Rate 下）的 title 會帶到所屬指標名稱、易誤解，改用序列自己的名稱；畫面「資料截至」用最後一筆觀測日，`last_updated` 是 FRED 檔案更新日；TradingView 序列（`TV_*`）`last_updated` 為 null，一律用最後一筆觀測日
- [ ] DA-09 ISM 製造業資料版本核對：`TV_USBCOI` 與 MacroMicro 在 2007–2020 年有差異（最大 2.8 點、6 個月 50 線判讀不同），以 ISM 官網歷史表確認哪一邊是現行季調修正值；若 TradingView 是首次公布值，畫面註明 [K 51–55]
- [ ] DA-10 日資料改用即時來源（FRED 日資料約落後 1–2 個營業日，例：2026-10-16 VIX 收 19.99，FRED `VIXCLS` 只到 10-15 的 16.46）
  - VIX：主序列改 Yahoo `^VIX`，FRED `VIXCLS` 留作對照
  - 其他 FRED 日資料也改用即時來源：`DFF`／`DFEDTARU`／`DFEDTARL`（聯邦基金利率）、`DGS10`、`SOFR`、`T10Y3M`／`T10Y2Y`（期限利差）、`DBAA`／`DAAA`、`BAMLC0A4CBBB`（信用利差）、`DTB3`、`T10YIE`（損益兩平通膨）、`DTWEXBGS`；逐一找可用來源，找不到即時來源的維持 FRED 並在畫面註明延遲
  - 換來源後的序列與 FRED 原序列做一致性比對（同 DA-04 做法）；用 Yahoo 等非官方來源時依 CLAUDE.md 註明
- [ ] DA-11 加上 FED Watch 來源顯示

# 畫面
- [ ] UI-02 指標詳細圖：點卡片展開，照講義格式「原值＋3 月均（QMA）＋12 月均（YMA）＋NBER 衰退陰影」，下方配 YoY 圖；門檻線（PMI 50、Sahm 0.5、Philly Fed 0、期限利差 0、債務 YoY 3%、損益兩平通膨 2%、VIX 12／20／30、YoY 0 線）；支援雙軸對照（如初領 vs 續領）
- [ ] UI-04 特殊圖：Beveridge 曲線（失業率 × 職缺率散佈）、殖利率曲線利差、Sahm Rule
- [ ] UI-05 公布行事曆：各指標下次公布時間（依講義公布規則）
- [ ] UI-06 頁尾：資料來源與講義出處聲明、版號（讀 `VERSION`）、最後更新日期
- [ ] UI-07 深色／淺色主題、手機版版面
- [ ] UI-08 Indicator 要顯示更日期、預估下次更新日期、與還有幾天 (有顏色表示)。注意時區 (台灣跟美國時差)
- [ ] UI-09 版權說明：資料來源（FRED 等各序列來源與使用條款）、講義出處（郭維裕《Fantastic Economic Indicators》，內容為自行摘要）、製作者；放頁尾或獨立「關於」區塊（可與 UI-06 合併做）
  - 要你決定：製作者署名寫法（姓名／EMBA 班別／聯絡方式）、是否加授權聲明（如程式 MIT、內容僅供課堂學習）
- [ ] UI-10 替代的指標要註明、沒有列出的也要註明
  - 資料層 DA-04 已標好（`substitute`、`unavailable`、`series[].note`），本項是畫面顯示
  - UI-01 留下：SOFR 卡因 `SOFR.json` substitute=true 也顯示「替代」，但 SOFR 本身是 MC 指標主序列，確認是否該標
- [ ] UI-11 每一個 BLOCK 要有 G（綠色：代表沒問題）、Y（黃色：代表警告、再觀察）、R（紅色：代表危險）
  - 與 UI-03 綜合訊號總覽相關；各指標的 G／Y／R 門檻要依講義判讀規則定
  - G／Y／R 以 DA-05 衍生值（`data/derived/`）對照講義門檻判斷（如 Sahm ≥ 0.5、赤字占 GDP 3%、NFP YoY 0 線），燈號匯總到 `index.html` 最上層的總覽
- [ ] UI-12 卡片數值細修：加單位（如美國債務 GFDEBTN 百萬美元、預算赤字）、原值接近 0 或為負時不顯示百分比變動（如 Sahm 0.00→▲100%）
- [ ] UI-13 卡片改讀 `data/derived/` 衍生序列（依 `indicators.json` 的 `derived_series`），取代 `index.html` 暫行規則表（DA-05 已產出）
  - 衍生值同時是 UI-11 燈號、UI-03 總覽的判斷輸入；卡片顯示的數字要跟判斷用的是同一個值
- [ ] UI-15 每個指標細項說明「指標內容、資料來源、判斷標準」（放在 UI-02 展開的細項面板，依賴 UI-02）
  - 指標內容：`indicators.json` 每個指標新增 `description`（依講義用自己的話摘要，附 `[K 頁碼]`）
  - 資料來源取自 `series[]`（替代要註明）；判斷標準取自 `rule`／`thresholds`／`signal`

# 文件
- [ ] DC-02 操作手冊 `manual.html`（文字配合截圖，後期）

## Complete
- [x] DC-01 README：資料來源依 FRED／Yahoo／EIA／TradingView／衍生序列列出序列代碼、替代與無公開資料指標、各來源條款；更新資料步驟（Node 24、fetch→derive、失敗不覆蓋）、本機預覽、專案結構（完成 2026-10-18）
- [x] UI-14 頁首 Banner 改用弗里德里希〈霧海上的旅人〉（c. 1818，公有領域，Wikimedia Commons），全站配色改用畫中色票（霧灰、岩褐、灰藍、赭）；Banner 標註出處；深色模式留給 UI-07（完成 2026-10-18）
- [x] UI-03 綜合訊號總覽：頁首下方新增 `section#signal-summary`，依 [K 4] 統計 19 項計入指標的擴張／中性／收縮（13 項不計），按領先／同時／落後拆表、給多數方向結論，32 個燈號格附判斷依據並可跳到卡片；判讀規則寫成 `indicators.json` 的 `signal` 欄位（raw 門檻／yoy／3 月均對 12 月均趨勢），格式寫入 SU-02 決策檔（完成 2026-10-18）
- [x] DA-05 衍生指標計算：新增 `tools/derive-data.mjs`，由 `data/series/` 算出 12 個衍生序列寫入 `data/derived/`（NFP 月增減／年增率、自算 Sahm Rule（對照 SAHMREALTIME）、CPI／核心 CPI／PCE／核心 PCE／PPI 年增率、BBB−AAA 利差、赤字占 GDP、Beveridge 資料對）；`indicators.json` 加 `derived_series`，格式寫入 SU-02 決策檔（完成 2026-10-18）
- [x] UI-01 版面骨架 `index.html`：頁首、六大分類分區、32 張指標卡片（最新值、較前期變動、迷你走勢、領先／同時／落後標籤、資料截至日）；暫行顯示規則表（NFP 月增減、CPI／PPI／PCE／M2 年增率、信用／TED 利差），來源標示（FRED／TradingView／Yahoo／EIA）、無公開資料灰卡、替代徽章，最小頁尾（完成 2026-10-18）
- [x] DA-04 非 FRED 指標處理（A1 B1 C1）：`tools/fetch-data.mjs` 新增 YAHOO／EIA／TRADINGVIEW 來源，新序列 `TV_USBCOI`、`TV_USNMBA`（替代）、`TV_BDI`、`YF_DXY`、`YF_GC`（替代）、`EIA_WCESTUS1`；消費者信心 `UMCSENT` 標替代、LME 列 `unavailable`；方案與一致性比對見 `doc/decisions/DA-04-非FRED指標方案.md`（完成 2026-10-18）
- [x] DA-02 抓資料腳本 `tools/fetch-data.mjs`（Node 24、零套件）：從 FRED 公開 CSV 抓序列 → `data/series/<ID>.json`；含 NBER 衰退期 `USREC`；只留 1970-01-01 起，61 個序列，格式定案寫入 SU-02 決策檔（完成 2026-10-18）
- [x] SU-04 建立 `dev` 分支流程：任務 worktree 從 `dev` 開出、`task-release` 收尾合併進 `dev`、說「release」才用新的 `project-release` skill 把 `dev` 合併到 `main`；CLAUDE.md、task-next、task-release、worker agents 同步（完成 2026-10-18）
- [x] DA-01 指標目錄 `data/indicators.json`：32 個指標（C 7／I 6／G 2／NX 3／MC 6／IFU 8）＋NBER 衰退期 `USREC`，格式定案寫入 `doc/decisions/SU-02-技術選型.md`（完成 2026-10-18）
- [x] SU-02 技術選型定案：單檔 `index.html`＋`data/*.json`，圖表庫 Apache ECharts 6.1.0（cdnjs＋SRI），決策紀錄 `doc/decisions/SU-02-技術選型.md`（完成 2026-10-18）
- [x] SU-01 建立 GitHub repo 與 GitHub Pages 部署：公開 repo `frid/macro-dashboard`，Pages 從 `main` 根目錄發佈 <https://frid.github.io/macro-dashboard/>（完成 2026-10-18）
- [x] SU-03 講義圖片頁整理（約 115 頁圖表），寫成 `doc/reference/郭維裕講義-圖表頁摘要.md`，並回填 `doc/reference/指標清單.md`（完成 2026-10-18）
- [x] SU-00 建立專案管理檔案：CLAUDE.md、TODO.md、VERSION、CHANGELOG.md、README.md、.gitignore、task-next／task-release skills、worker／verifier agents、指標清單（完成 2026-10-18）
