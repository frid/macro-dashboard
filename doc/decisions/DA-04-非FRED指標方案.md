# DA-04 非 FRED 指標方案（草案，待確認）

- 狀態：**草案**——等使用者確認「要你決定的點」A、B、C 後才動工
- 日期：2026-10-18（同日補 TradingView 實測與替代指標一致性比對）
- 範圍：`data/indicators.json` 中 `status: "pending"` 的 7 個指標，加上已用替代序列的美元指數，共 8 個
- 相關：`doc/reference/指標清單.md`（狀態／替代欄）、`doc/decisions/SU-02-技術選型.md`（資料格式）

## 1. 來源實測（2026-10-18，WSL 環境）

| 來源 | 端點 | 結果 | 備註 |
|---|---|---|---|
| EIA 官網網頁 | `eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=WCESTUS1&f=W` | ✅ 200，HTML 表格 | 最新一筆 2026-10-09：415,577 千桶；不需 API key |
| EIA 官網 xls | `eia.gov/dnav/pet/hist_xls/WCESTUS1w.xls` | ✅ 200，舊版 Excel（BIFF） | 零套件難解析，不採用 |
| Yahoo chart API | `query1.finance.yahoo.com/v8/finance/chart/DX-Y.NYB` | ✅ 200，JSON | ICE 美元指數（講義用的 DXY）；`range=max` 會降採樣，日線要指定 `range=10y` 等 |
| Yahoo chart API | `…/chart/GC=F` | ✅ 200，JSON | COMEX 黃金期貨 |
| Yahoo chart API | `…/chart/^BDI` | ❌ 404 | Yahoo 沒有 BDI |
| stooq CSV | `stooq.com/q/d/l/?s=xauusd` | ❌ 瀏覽器驗證頁 | 需要 JavaScript，腳本抓不到 |
| MacroMicro | `macromicro.me/charts/data/54` | ❌ curl 403（Cloudflare） | headless Chrome 可拿到 ISM 1990–，但未登入有觀看額度（`quota_remains`）；不採用 |
| Investing.com | `hk.investing.com/economic-calendar/…-176`、`sbcharts.investing.com/events_charts/us/176.json` | ❌ curl 與 headless Chrome 皆 403 | 不採用 |
| TradingView 圖表 WebSocket | `wss://data.tradingview.com/socket.io/websocket` | ✅ 未登入可取完整歷史 | 非官方協定；Node 24 內建 WebSocket 即可，不需 Chrome、不需套件 |
| FRED CSV | `fredgraph.csv?id=…` | ✅ 200 | **OECD 信心序列 `BSCICP03USM665S`、`CSCICP03USM665S` 最後一筆 2024-01，已停更** |

TradingView 實測代碼（未登入，`unauthorized_user_token`）：

| 代碼 | 名稱 | 頻率 | 筆數 | 起 → 迄 |
|---|---|---|---|---|
| `ECONOMICS:USBCOI` | United States ISM Purchasing Managers Index (PMI) | 月 | 945 | 1948-01 = 51.7 → 2026-09 = 54.5 |
| `ECONOMICS:USNMBA` | United States ISM Non-Manufacturing Business Activity | 月 | 351 | 1997-07 = 58.6 → 2026-09 = 56.5 |
| `ECONOMICS:USCCI` | United States Consumer Confidence Index | 月 | 677 | 1952-11 = 86.2 → 2026-10 = 46.3 |
| `INDEX:BDI` | BALTIC DRY INDEX | 日 | 10,461 | 1969-12-31 = 610 → 2026-10-16 = 2,511 |
| `TVC:DXY` | U.S. Dollar Currency Index | 日 | 14,139 | 1967-01 → 2026-10-15 = 101.779 |
| `OANDA:XAUUSD` | Gold（現貨） | 日 | 14,873 | 1833 → 2026-10-15 = 4,165.42 |

- ISM 服務業「總指數」（Services PMI）在 TradingView 搜不到（試過 `USNMPMI`、`USNMI`、`USSPMI`、`USSERPMI` 皆 invalid）；只有細項（商業活動 `USNMBA`、新訂單 `USNMNO`、就業 `USNMEMP`、價格 `USNMPR`），沒有供應商交貨。`USNMBA` 是 2008 年以前 ISM 服務業的主指標。
- **`USCCI` 不是 Conference Board CCI**：頁面中繼資料 `source2` 為 University of Michigan；與 FRED `UMCSENT` 重疊 675 個月中 664 個月（98.4%）數值相同；起始 1952 年（Conference Board 1967 年才開始）。TradingView 也搜不到 Conference Board 版本。→ 不採用（與 `UMCSENT` 重複）。
- **TradingView 日線日期比實際交易日早一天**（時間戳記是前一日 UTC）：對齊前黃金期貨／現貨日報酬相關 0.19，日期加一天後 0.90。實作必須加一天。
- LME 金屬庫存：TradingView 只有 LME 期貨價格、沒有庫存；仍無免費來源。
- 尚未測：從 GitHub Actions（雲端 IP）連 TradingView 會不會被擋。

仍沒有免費來源：Conference Board CCI、ISM 服務業綜合 PMI、LME 庫存。

## 2. 替代指標與原數據／講義判讀的一致性（2026-10-18 實算）

| 指標 | 比對 | 與原數據 | 與講義判讀 | 結論 |
|---|---|---|---|---|
| ISM 製造業 [K 51–55] | TradingView `USBCOI` vs MacroMicro | 重疊 441 月，274 月完全相同；差異集中 2007–2020（最大 2.8 點），疑為季調修正版本不同（首次公布值 vs 修正值） | 50 線規則直接適用；但有 6 個月兩來源落在 50 線不同側（如 2012-06：MacroMicro 51.0、TradingView 49.5） | 可用；**資料版本待查**（見第 6 節） |
| ISM 製造業對照 | OECD 製造業信心 `BSCICP03USM665S` | 水準相關 0.987，無時間落差 | ISM ≥ 50 對 OECD ≥ 100 判讀一致率僅 81.4%（2022 下半年不一致） | **刪除**：一致率不足，且 2024-01 後停更 |
| ISM 服務業 [K 56–59] | `USNMBA` vs 三項近似綜合（商業活動＋新訂單＋就業平均） | 相關 0.958 | 50 線判讀一致 95.2%；但商業活動平均高約 2.1 點，低於 50 的月數 26 個 vs 近似綜合 43 個，**會漏掉部分收縮訊號** | 可當替代，畫面註明偏樂觀 |
| 消費者信心 [K 11–15] | `UMCSENT`（密大）vs Conference Board CCI | 無 CB 數據可比 | 講義重點是看一段時間的趨勢方向，密大指數可照此判讀 | 可當替代，畫面標「替代」 |
| 消費者信心對照 | OECD 消費者信心 `CSCICP03USM665S` | 與 `UMCSENT` 水準相關 0.990 | 12 月變化方向一致 91.4% | **刪除**：2024-01 後停更 |
| 美元指數 [K 99–102] | Fed 廣義 `DTWEXBGS` vs ICE DXY | 水準相關 0.889，日報酬相關 0.751 | 季（63 日）強弱方向一致 86.6%；廣義美元的歐元權重遠低於 DXY 的約 57.6% | 主序列改 Yahoo ICE DXY 有必要；Yahoo 與 TradingView DXY 一致 |
| 黃金 [K 130–131] | COMEX `GC=F` vs 現貨 `OANDA:XAUUSD` | 水準相關 0.9994；價差平均 +0.17%；日報酬相關 0.90（日期對齊後） | 講義看避險情緒趨勢，期貨可代表 | 可當替代 |

近似綜合指數缺供應商交貨，只是估計值，僅用於判斷偏差方向。

## 3. 各指標方案

| 指標 | 講義來源 | 方案 | 序列 | 來源 | status | 畫面標示 |
|---|---|---|---|---|---|---|
| ISM 製造業 PMI [K 51–55] | Bloomberg `NAPMPMI` | **ISM 原序列，經 TradingView**（見決定點 B、C） | `TV_USBCOI`（月） | TRADINGVIEW | `ok` | 門檻線 50 |
| ISM 服務業 PMI [K 56–59] | Bloomberg `NAPMNMI` | 替代：ISM 服務業商業活動指數（綜合 PMI 無來源） | `TV_USNMBA`（月） | TRADINGVIEW | `substitute` | 「替代：ISM 服務業商業活動細項，非綜合 PMI；平均高於綜合 PMI 約 2 點，跌破 50 的次數較少」；門檻線 50 |
| 消費者信心 CCI [K 11–15] | Bloomberg `CONCCONF` | 替代：密大消費者信心（Conference Board CCI 無免費來源；TradingView `USCCI` 實為密大，不用） | `UMCSENT`（月） | FRED | `substitute` | 「替代：密大消費者信心，非 Conference Board CCI」 |
| 波羅的海乾散貨指數 BDI [K 94–98] | Bloomberg `BDIY` | **原序列，經 TradingView** | `TV_BDI`（`INDEX:BDI`，日） | TRADINGVIEW | `ok` | — |
| 美元指數 [K 99–102] | ICE DXY（Yahoo） | 主序列改用 Yahoo ICE DXY；Fed 廣義美元指數降為對照（見決定點 A） | `YF_DXY`（`DX-Y.NYB`，日）＋`DTWEXBGS`（compare） | YAHOO＋FRED | `ok` | 對照序列標「Fed 廣義美元，非 DXY」 |
| LME 金屬庫存 [K 60–65] | Bloomberg `LSAH`／`LSNI` | 先不做：沒有免費來源 | — | — | `unavailable` | 「無免費資料來源」 |
| 黃金 [K 130–131] | Bloomberg `XAUUSD` | 替代：COMEX 黃金期貨（LBMA 現貨已自 FRED 下架） | `YF_GC`（`GC=F`，日） | YAHOO | `substitute` | 「替代：COMEX 期貨，非 LBMA 現貨」 |
| 原油庫存 [K 103–106] | Bloomberg `DOESCRUD` | EIA 官方原始序列：不含 SPR 的商業原油庫存 | `EIA_WCESTUS1`（週） | EIA | `ok` | — |

結果：可抓 7 個（其中 3 個替代：ISM 服務業、消費者信心、黃金）、不做 1 個（LME）。OECD 對照序列因停更全部不用。

說明：DXY 與黃金在 TradingView 也有（`TVC:DXY`、`OANDA:XAUUSD` 現貨），但 Yahoo 已可用；為了少依賴非官方端點，TradingView 只補「其他地方都沒有」的序列。若 C 選 2，黃金可改用 `OANDA:XAUUSD` 現貨，免掉「期貨替代」標示。

## 4. 要你決定的點

**A. Yahoo 非官方端點的使用範圍**（日後可能被擋或改版；失敗時保留舊資料，不會壞網頁）

1. 黃金＋ICE DXY 都用 Yahoo ← **建議**（講義用的就是 ICE DXY）
2. 只有黃金用 Yahoo，美元指數維持 `DTWEXBGS` 替代

**B. ISM 製造業 PMI**（OECD 製造業信心已停更，不再是選項）

1. 用 TradingView 抓 ISM 原序列（1948–，門檻 50） ← **建議**（前提是 C 不選 3）
2. 手動維護 CSV（每月自己填 ISM 新聞稿數字；ISM 服務業綜合 PMI 也可一併手動，免用替代）

**C. TradingView 非官方 WebSocket 的使用範圍**

風險：非公開協定，可能改版或封鎖；TradingView 使用條款原則上不允許自動抓取，ISM／Baltic Exchange 數據本身也有授權限制，公開放在 GitHub Pages 屬灰色地帶。GitHub Actions 能否連線尚未實測。

1. 只補「別處沒有」的 3 條：ISM 製造業、ISM 服務業商業活動、BDI ← **建議**
2. 再加黃金改用 `OANDA:XAUUSD` 現貨（DXY 仍用 Yahoo）
3. 不用 TradingView：ISM 製造業只能選 B2 手動，否則與 ISM 服務業、BDI 一起列 `unavailable`

## 5. 資料格式變更（相容舊資料）

- `series[].source` 新增 `"YAHOO"`、`"EIA"`、`"TRADINGVIEW"`（原本只有 `"FRED"`）。
- TradingView 序列另記原始代碼（如 `"tvSymbol": "ECONOMICS:USBCOI"`），抓取時用；`id` 用 `TV_` 前綴。
- `status` 新增 `"unavailable"`：沒有免費來源、不抓資料；`series` 為空陣列，`external` 保留講義原來源名稱。
- 非 FRED 序列檔名加來源前綴（`YF_`、`EIA_`、`TV_`），避免與 FRED 代碼撞名；檔案內容格式與現有 `data/series/<ID>.json` 相同。
- 抓取失敗：印出明確錯誤、不覆蓋舊檔（沿用 DA-02 做法）。TradingView 連線加逾時（約 30 秒），失敗不影響其他來源。

確認後這些格式規則會併入 `doc/decisions/SU-02-技術選型.md`。

## 6. 確認後的實作步驟

1. `tools/fetch-data.mjs`：依 `source` 分派 FRED／YAHOO／EIA／TRADINGVIEW，新增 Yahoo JSON、EIA HTML 表格解析，以及 TradingView WebSocket 抓取（Node 24 內建 `WebSocket`，不加套件；月線 `1M`、日線 `1D`，取收盤值）。
   - **TradingView 日線日期 +1 天**（時間戳記為前一日 UTC）；月線取年月、日固定為 01。
   - Yahoo 日線不用 `range=max`（會降採樣）。
2. `data/indicators.json`：依第 3 節更新 8 個指標（消費者信心 `UMCSENT` 改標 `substitute: true`）。
3. 執行腳本產生新序列檔。
4. 更新 `doc/decisions/SU-02-技術選型.md` 與 `doc/reference/指標清單.md`。
5. GitHub Actions 排程任務時，實測雲端 IP 能否連 TradingView；不行就在 Actions 跳過該來源、保留舊檔。

待查（不擋實作）：ISM 製造業 2007–2020 年 TradingView 與 MacroMicro 不同，需以 ISM 官網歷史表核對哪一邊是現行季調修正值；若 TradingView 是首次公布值，畫面註明「首次公布值」。

版號：0.3.0 → 0.4.0（MINOR）。派工：worker-opus 實作、verifier-sonnet 驗證。
