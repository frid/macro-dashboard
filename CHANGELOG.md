# CHANGELOG

格式：`## 版號 — YYYY-MM-DD`，條列「任務代號 摘要」。新版本加在最上面。版號規則見 CLAUDE.md §版本。

## 0.16.1 — 2026-10-18
- UI-06 頁尾分開顯示「版本／網站更新／資料抓取」：資料抓取日取頁面已載入序列 `fetched_at` 的最大值（不多抓檔，`fedwatch.json` 待 UI-17 讀入時再納入）；版號改讀根目錄 `VERSION`（符合 SemVer 才覆寫，讀不到沿用頁尾寫死值）；資料來源與講義出處聲明已由 UI-09 完成

## 0.15.0 — 2026-10-18
- DA-11 FedWatch 利率機率資料：`tools/fetch-data.mjs` 新增 `FEDWATCH`（`node tools/fetch-data.mjs FEDWATCH` 可單獨執行），解析 federalreserve.gov FOMC 日程、抓 Yahoo ZQ 各月合約（非官方），依 CME FedWatch 方法自算最近一場 FOMC 會議的目標區間機率與 Now／1D／1W／1M 比較，寫入 `data/fedwatch.json`（替代；失敗不覆寫）；2026-10-28 會議 Now 84.5／15.5、1W 82.3／17.7、1M 42.4／57.6 與 CME 一致；`fed-funds-rate` 的 `external` 新增選用 `url` 指向 CME FedWatch；SU-02 決策檔、README 同步；畫面留給 UI-17

## 0.14.0 — 2026-10-18
- UI-15 指標細項說明：詳細面板圖表下方加「指標內容／資料來源／判斷標準」三欄（寬螢幕三欄、600px 以下單欄）；`indicators.json` 32 個指標新增 `description`（講義自行摘要，附 [K 頁碼]）；資料來源列出全部序列、替代徽章、延遲、原始來源與衍生序列；判斷標準列 `rule`、門檻與 `signal` 白話句；圖表區與說明區分開，載入失敗不影響說明

## 0.13.2 — 2026-10-18
- UI-12 卡片數值細修：`indicators.json` 序列加 `unit`；卡片數值與變動帶單位（百萬美元換算億／兆美元並註原始單位、% 類變動用「個百分點」）；前值或現值 ≤ 0 時不顯示百分比變動（修 Sahm ▲100%）；詳細圖 caption、Y 軸、tooltip 加單位

## 0.13.1 — 2026-10-18
- UI-11 修正：綜合訊號總覽表改依燈號計數，欄位改為「沒問題／觀察／危險／未判」；燈號格與卡片狀態文字同步改名（Y 由「警告、再觀察」改為「觀察」）；上方擴張／收縮結論句不變

## 0.13.0 — 2026-10-18
- UI-11 G／Y／R 燈號：32 張卡片標題列與綜合訊號總覽格子加燈號（G 沒問題／Y 警告、再觀察／R 危險／— 未判），總覽加燈號統計行；門檻型訊號（ISM 50、Sahm 0.5、殖利率倒掛、NFP／M2 年增率 0、VIX 20／30）跨門檻為 R，趨勢型轉弱為 Y；`indicators.json` 新增 `light` 欄位補判預算赤字 [K 67–68]、債務 YoY [K 69–91]、PCE [K 178–182]、TIPS 損益兩平 [K 188–190]；`loadSeries` 可讀 `data/derived/`；格式寫入 SU-02 決策檔

## 0.12.0 — 2026-10-18
- DA-10 日資料改用即時來源：`tools/fetch-data.mjs` 新增 CBOE（Cboe 官方 VIX 歷史 CSV）與 UST（FRED 歷史＋美國財政部每日利率 CSV 最新日，同日以 FRED 為準；任一邊失敗不覆寫）來源；VIX 主序列改 `CBOE_VIX`、聯邦基金利率對照改 `UST_DGS10`、TED 利差成分改 `UST_DTB3`，皆比 FRED 早 1 個營業日、重疊期間與 FRED 100% 相同；維持 FRED 的序列加 `lag` 欄位，卡片與詳細圖來源列顯示「延遲」註記；比對與來源決定表寫入 DA-04 決策檔，SU-02 補新欄位格式，README、指標清單同步

## 0.11.1 — 2026-10-18
- UI-09 修正：「關於本站」改為常駐展開的 `<section>`，不再用摺疊選單（`<details>`）

## 0.11.0 — 2026-10-18
- UI-09 版權說明：頁尾前加可摺疊「關於本站」區塊——資料來源與使用條款（FRED、EIA、Yahoo Finance、TradingView、衍生序列、替代序列）、講義出處（郭維裕《Fantastic Economic Indicators》，自行摘要 [K 頁碼]）、製作者侯榮富 博士、版權歸屬（程式與摘要／講義／數據三方）與「僅供課堂學習、不構成投資建議、引用轉載須經作者同意」聲明；README 聲明段同步

## 0.10.1 — 2026-10-18
- DC-01 README 補齊：資料來源依 FRED／Yahoo（非官方）／EIA／TradingView（非官方）／衍生序列列出序列代碼、替代序列與無公開資料指標、各來源條款連結；更新資料步驟（Node 24、先 fetch 再 derive、失敗不覆蓋舊檔）、本機預覽（HTTP server）、專案結構；TODO 新增 DA-11（FED Watch 來源）、UI-15（指標細項說明內容／來源／判斷標準）

## 0.10.0 — 2026-10-18
- UI-02 指標詳細圖：卡片可點（含鍵盤），開啟 `<dialog>` 顯示講義格式詳細圖——原值＋3 月均（QMA）＋12 月均（YMA，依日期視窗計算，依 `derived` 決定是否畫）＋NBER 衰退灰帶（USREC），下方 YoY 圖固定 0 線；門檻虛線讀 `thresholds[]`，新增 `on:"yoy"`（畫在 YoY 圖）與 `series`（只對特定序列畫，修正預算赤字 −3 線錯置）；`series[].axis` 支援雙軸對照 [K 18, 22, 44, 77]；lttb 降取樣、上下圖連動 dataZoom（預設近 20 年）；`?detail=<id>` 直接開啟；SU-02 決策檔補新欄位；TODO 新增 DA-12、DA-13

## 0.9.0 — 2026-10-18
- DA-07 G 區債務圖組衍生序列：`tools/derive-data.mjs` 新增共用 `stockToGdp`（存量 ÷ 名目 GDP，季初對齊、GDP 未公布時用最新一季並記錄），為 GFDEBTN、HMLBSHNO、MABSHNO、CMLBSHNO、SLOASM、REVOLSL、MVLOASM 各產生 YoY、占 GDP 比、占 GDP 比 YoY 共 21 檔 `data/derived/DRV_*`（REVOLSL 占 GDP 比只取季末月）；GFDEBTN 占 GDP 比對照 GFDEGDQ188S（225 點最大差 0.56 pp）；`indicators.json` 美國債務與槓桿加 `derived_series`，MABSHNO 更正為家庭持有房貸資產 [K 69–91]

## 0.8.0 — 2026-10-18
- UI-14 頁首改用弗里德里希〈霧海上的旅人〉（c. 1818，公有領域）裁切的 Banner `assets/wanderer-banner.jpg`，加暗色漸層與出處標註（Wikimedia Commons）；全站配色改為畫中色票（霧灰底、岩褐文字、灰藍主色／上升、赭色下降），寫死的顏色全收進 `:root` token，迷你走勢圖改讀 CSS 變數；對比皆 ≥ 4.5:1

## 0.7.0 — 2026-10-18
- UI-03 新增綜合訊號總覽：`indicators.json` 每個指標加 `signal` 判讀規則（19 項：原值對門檻、年增率對 0、近 3 月均對近 12 月均；13 項不計），`index.html` 頁首下方顯示擴張／中性／收縮統計（依領先／同時／落後拆表）、多數方向結論 [K 4] 與 32 個燈號格（附判斷依據、點擊跳到卡片）；卡片讀取邏輯抽成共用 `loadPoints()`，SU-02 決策檔補 `signal` 格式

## 0.6.0 — 2026-10-18
- DA-05 衍生指標計算：新增 `tools/derive-data.mjs`（Node 24、零套件、原子寫入、輸入缺檔不覆蓋舊檔），由 `data/series/` 算出 12 個衍生序列寫入 `data/derived/<ID>.json`：NFP 月增減與年增率、由 UNRATE 自算 Sahm Rule（附與 SAHMREALTIME 差異統計）、CPI／核心 CPI／PCE／核心 PCE／PPI（PPIFIS、PPIACO）年增率、BBB−AAA 利差（DBAA−DAAA）、赤字占 GDP（MTSDS133FMS 近 12 月合計 ÷ 名目 GDP，附與 FYFSGDA188S 對照）、Beveridge 曲線資料對；`indicators.json` 新增 `derived_series`、預算赤字補 `ratio_gdp`；SU-02 決策檔補衍生檔格式與執行順序（fetch → derive），README 同步

## 0.5.0 — 2026-10-18
- UI-01 新增 Dashboard 主頁 `index.html`：六大分類分區與 32 張指標卡片（最新值、較前期變動、迷你走勢、L／C／G 標籤、資料截至日），暫行顯示規則（NFP 月增減、物價與 M2 年增率、利差），配合 DA-04 依序列來源標示 FRED／TradingView／Yahoo Finance／EIA，無公開資料灰卡與替代徽章，頁尾版號

## 0.4.0 — 2026-10-18
- DA-04 非 FRED 指標：`tools/fetch-data.mjs` 依 `source` 分派 FRED／YAHOO／EIA／TRADINGVIEW（Node 24 內建 WebSocket、零套件），序列 61 → 67；ISM 製造業、BDI 改用原序列（TradingView），ISM 服務業以商業活動細項替代，美元指數主序列改 ICE DXY（Yahoo），黃金以 COMEX 期貨替代，原油庫存用 EIA 官方序列，消費者信心 `UMCSENT` 標替代（非 Conference Board），LME 庫存列 `unavailable`；新增方案與替代指標一致性比對 `doc/decisions/DA-04-非FRED指標方案.md`，SU-02 格式規則與指標清單同步

## 0.3.0 — 2026-10-18
- DA-02 新增抓資料腳本 `tools/fetch-data.mjs`（Node 24、零套件）：從 FRED 公開 CSV 抓 `data/indicators.json` 引用的 61 個序列（含 NBER 衰退期 `USREC`），1970-01-01 起，寫入 `data/series/<ID>.json`（原子寫入、失敗不覆蓋舊檔、結束碼 1）；SU-02 決策檔序列格式定案，README 補本機更新資料說明

## 0.2.1 — 2026-10-18
- SU-04 建立 `dev` 整合分支：任務 worktree 從 `dev` 開出、收尾時合併進 `dev`；新增 `project-release` skill，使用者說「release」才把 `dev` 合併到 `main` 並打 tag；CLAUDE.md §Git 規則／工作流程、task-next 1.1.0、task-release 1.1.0、worker agents 同步更新

## 0.2.0 — 2026-10-18
- DA-01 新增指標目錄 `data/indicators.json`：32 個指標依 C／I／G／NX／MC／IFU 分類，含時序、頻率、公布規則、FRED 序列（主／對照／組成、替代標記）、衍生算法代號、門檻線、判讀規則、講義頁碼、狀態（ok／substitute／pending）；NBER 衰退期 `USREC`；SU-02 決策檔補上目錄格式說明

## 0.1.2 — 2026-10-18
- SU-02 技術選型定案：單檔 `index.html`＋`data/*.json`，圖表庫 Apache ECharts 6.1.0（cdnjs、鎖版號＋SRI）；新增決策紀錄 `doc/decisions/SU-02-技術選型.md`，CLAUDE.md／README 架構段同步

## 0.1.1 — 2026-10-18
- SU-01 建立公開 GitHub repo `frid/macro-dashboard`，開啟 GitHub Pages（`main` 根目錄）；README 加上線上網址與原始碼連結

## 0.1.0 — 2026-10-18
- SU-00 建立專案管理檔案（CLAUDE.md、TODO.md、VERSION、CHANGELOG.md、README.md、.gitignore、task-next／task-release skills、worker／verifier agents）
- 新增 `doc/reference/指標清單.md`：講義指標與 FRED 序列對照（2026-10-18 實測可抓）
- SU-03 講義圖表頁整理成 `doc/reference/郭維裕講義-圖表頁摘要.md`
