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
- [ ] DA-08 序列 title 修正：對照／組成序列（如 DGS10 掛在 Fed Funds Rate 下）的 title 會帶到所屬指標名稱、易誤解，改用序列自己的名稱；畫面「資料截至」用最後一筆觀測日，`last_updated` 是 FRED 檔案更新日；TradingView 序列（`TV_*`）`last_updated` 為 null，一律用最後一筆觀測日
- [ ] DA-09 ISM 製造業資料版本核對：`TV_USBCOI` 與 MacroMicro 在 2007–2020 年有差異（最大 2.8 點、6 個月 50 線判讀不同），以 ISM 官網歷史表確認哪一邊是現行季調修正值；若 TradingView 是首次公布值，畫面註明 [K 51–55]
- [ ] DA-12 Philly Fed 未來指數：抓 `GAFDFSA066MSFRBPHI`（Future General Activity），加進 `philly-fed` 當雙軸對照（現況 vs 未來）[K 124]；UI-02 雙軸已就緒，資料到位後補 `axis: "right"`
- [ ] DA-13 補齊 `indicators.json` 的 `derived`（qma／yma／yoy）：UI-02 詳細圖依 `derived` 決定畫不畫 3 月均／12 月均與 YoY 圖，目前只有汽車銷售、M2、黃金、CPI、PPI 標了 qma／yma；逐一對照講義各指標圖頁補齊（季資料只有 YMA，如債務槓桿 [K 69–91]）

# 畫面
- [ ] UI-04 特殊圖：Beveridge 曲線（失業率 × 職缺率散佈）、殖利率曲線利差、Sahm Rule
- [ ] UI-05 公布行事曆：各指標下次公布時間（依講義公布規則）
- [ ] UI-06 頁尾：資料來源與講義出處聲明、版號（讀 `VERSION`）、最後更新日期
- [ ] UI-07 深色／淺色主題、手機版版面
- [ ] UI-08 Indicator 要顯示更日期、預估下次更新日期、與還有幾天 (有顏色表示)。注意時區 (台灣跟美國時差)
- [ ] UI-10 替代的指標要註明、沒有列出的也要註明
  - 資料層 DA-04 已標好（`substitute`、`unavailable`、`series[].note`），本項是畫面顯示
  - UI-01 留下：SOFR 卡因 `SOFR.json` substitute=true 也顯示「替代」，但 SOFR 本身是 MC 指標主序列，確認是否該標
- [ ] UI-13 卡片改讀 `data/derived/` 衍生序列（依 `indicators.json` 的 `derived_series`），取代 `index.html` 暫行規則表（DA-05 已產出）
  - 衍生值同時是 UI-11 燈號、UI-03 總覽的判斷輸入；卡片顯示的數字要跟判斷用的是同一個值
- [ ] UI-16 加上回到最上層的按鈕
- [ ] UI-17 FedWatch 區塊：讀 `data/fedwatch.json` 顯示最近一場 FOMC 會議的目標利率區間機率（Ease／No change／Hike、Now／1D／1W／1M），標「替代：依 CME 方法以 ZQ 期貨自算」，附連結 <https://www.cmegroup.com/cn-t/markets/interest-rates/cme-fedwatch-tool.html>（依賴 DA-11）

# 文件
- [ ] DC-02 操作手冊 `manual.html`（文字配合截圖，後期）

## Complete
- [x] DA-11 FedWatch 利率機率資料：`tools/fetch-data.mjs` 新增 `FEDWATCH`，解析 federalreserve.gov FOMC 日程、抓 Yahoo ZQ 各月合約，依 CME FedWatch 方法自算最近一場會議的目標區間機率（Now／1D／1W／1M）寫入 `data/fedwatch.json`（替代，2026-10-28 會議 84.5／15.5 與 CME 一致）；`fed-funds-rate` 的 `external` 加 CME 連結 `url`；畫面另開 UI-17（完成 2026-10-18）
- [x] UI-15 指標細項說明：UI-02 詳細面板圖表下方加「指標內容／資料來源／判斷標準」三欄；`indicators.json` 32 個指標新增 `description`（講義摘要，附 [K 頁碼]）；資料來源列全部序列（主序列／對照／計算成分、替代徽章、延遲、原始付費來源、衍生序列）；判斷標準列 `rule`、`thresholds` 與 `signal` 白話說明；圖表載入失敗時說明仍保留（完成 2026-10-18）
- [x] UI-12 卡片數值細修：`indicators.json` series[] 加 `unit`（百萬美元／十億美元／%／指數／千人等 68 序列）；卡片數值與變動帶單位，百萬美元換算成億／兆美元並註原始單位；% 類序列變動改「個百分點」；raw 卡只在前值與現值皆 > 0 時才附 % 變動（修 Sahm -0.07→0 顯示 ▲100%）；詳細圖 caption／Y 軸名稱／tooltip 加單位（完成 2026-10-18）
- [x] UI-11 每個指標卡片與總覽加 G／Y／R 燈號：門檻型（raw／yoy）訊號擴張 G、中性 Y、跨門檻 R，趨勢型轉弱只到 Y；新增 `light` 欄位補判預算赤字（赤字占 GDP > 3% → R）、債務 YoY > 3%、PCE 年增率 > 2%、TIPS 損益兩平 ≥ 2%（Y）；總覽加燈號統計，`data/derived/` 可直接讀（完成 2026-10-18）
- [x] DA-10 日資料改用即時來源：VIX 主序列改 Cboe 官方 CSV（`CBOE_VIX`，`VIXCLS` 留作對照）；10 年期公債、3 個月國庫券改為 FRED 歷史接上美國財政部最新日（`UST_DGS10`、`UST_DTB3`），皆比 FRED 早 1 個營業日、重疊期間 100% 相同；T10Y3M／T10Y2Y／T10YIE、DFF／SOFR、目標區間已與官方同步，DBAA／DAAA／BAMLC0A4CBBB／DTWEXBGS 無免費即時來源，維持 FRED 並以 `lag` 在畫面註明延遲；比對紀錄見 DA-04 決策檔（完成 2026-10-18）
- [x] UI-09 版權說明：資料來源（FRED 等各序列來源與使用條款）、講義出處（郭維裕《Fantastic Economic Indicators》，內容為自行摘要）、製作者；放頁尾或獨立「關於」區塊（可與 UI-06 合併做）（完成 2026-10-18）
- [x] DC-01 README：資料來源依 FRED／Yahoo／EIA／TradingView／衍生序列列出序列代碼、替代與無公開資料指標、各來源條款；更新資料步驟（Node 24、fetch→derive、失敗不覆蓋）、本機預覽、專案結構（完成 2026-10-18）
- [x] UI-02 指標詳細圖：點卡片（或鍵盤 Enter／Space）開 `<dialog>`，照講義格式畫原值＋3 月均（QMA）＋12 月均（YMA）＋NBER 衰退陰影，下方 YoY 圖；`thresholds[]` 畫門檻虛線（新增 `on:"yoy"`、`series` 欄位），`series[].axis` 支援雙軸對照（初領／續領、U6／兼職、耐久財、房貸）；lttb 降取樣＋上下圖連動縮放（預設近 20 年）；`?detail=<id>` 直接開啟（完成 2026-10-18）
- [x] DA-07 G 區債務圖組：抓 `GFDEBTN`、`HMLBSHNO`、`MABSHNO`、`CMLBSHNO`、`SLOASM`、`REVOLSL`、`MVLOASM`、`GDP`，算 YoY 與占 GDP 比 [K 69–91]：21 個衍生序列（YoY、占 GDP 比、占 GDP 比 YoY）寫入 `data/derived/`（完成 2026-10-18）
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
