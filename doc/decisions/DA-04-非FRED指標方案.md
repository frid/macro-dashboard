# DA-04 非 FRED 指標方案（草案，待確認）

- 狀態：**草案**——等使用者確認「要你決定的點」A、B、C 後才動工
- 日期：2026-10-18（同日補 TradingView 實測）
- 範圍：`data/indicators.json` 中 `status: "pending"` 的 7 個指標，加上已用替代序列的美元指數，共 8 個
- 相關：`doc/reference/指標清單.md`（狀態／替代欄）、`doc/decisions/SU-02-技術選型.md`（資料格式）

## 1. 來源實測（2026-10-18，WSL 環境）

| 來源 | 端點 | 結果 | 備註 |
|---|---|---|---|
| EIA 官網網頁 | `eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=WCESTUS1&f=W` | ✅ 200，HTML 表格 | 最新一筆 2026-10-09：415,577 千桶；不需 API key |
| EIA 官網 xls | `eia.gov/dnav/pet/hist_xls/WCESTUS1w.xls` | ✅ 200，舊版 Excel（BIFF） | 零套件難解析，不採用 |
| Yahoo chart API | `query1.finance.yahoo.com/v8/finance/chart/DX-Y.NYB` | ✅ 200，JSON | ICE 美元指數（講義用的 DXY） |
| Yahoo chart API | `…/chart/GC=F` | ✅ 200，JSON | COMEX 黃金期貨 |
| Yahoo chart API | `…/chart/^BDI` | ❌ 404 | Yahoo 沒有 BDI |
| stooq CSV | `stooq.com/q/d/l/?s=xauusd` | ❌ 瀏覽器驗證頁 | 需要 JavaScript，腳本抓不到 |
| MacroMicro | `macromicro.me/charts/data/54` | ❌ curl 403（Cloudflare） | headless Chrome 可拿到 ISM 1990–，但未登入有觀看額度（`quota_remains`）；不採用 |
| TradingView 圖表 WebSocket | `wss://data.tradingview.com/socket.io/websocket` | ✅ 未登入可取完整歷史 | 非官方協定；Node 24 內建 WebSocket 即可，不需 Chrome、不需套件 |
| FRED CSV | `fredgraph.csv?id=…` | ⚠️ 本次環境逾時 | DA-02 用同一端點正常；OECD 序列代碼待 worker 實抓確認 |

TradingView 實測代碼（未登入，`unauthorized_user_token`）：

| 代碼 | 名稱 | 頻率 | 筆數 | 起 → 迄 |
|---|---|---|---|---|
| `ECONOMICS:USBCOI` | United States ISM Purchasing Managers Index (PMI) | 月 | 945 | 1948-01 = 51.7 → 2026-09 = 54.5 |
| `ECONOMICS:USNMBA` | United States ISM Non-Manufacturing Business Activity | 月 | 351 | 1997-07 = 58.6 → 2026-09 = 56.5 |
| `ECONOMICS:USCCI` | United States Consumer Confidence Index | 月 | 677 | 1952-11 = 86.2 → 2026-10 = 46.3 |
| `INDEX:BDI` | BALTIC DRY INDEX | 日 | 10,461 | 1969-12-31 = 610 → 2026-10-16 = 2,511 |
| `TVC:DXY` | U.S. Dollar Currency Index | 日 | 14,139 | 1967-01 → 2026-10-15 = 101.779 |
| `OANDA:XAUUSD` | Gold（現貨） | 日 | 14,873 | 1833 → 2026-10-15 = 4,165.42 |

- ISM 製造業 PMI 最近兩筆（2026-08 = 54.6、2026-09 = 54.5）與 MacroMicro 一致。
- ISM 服務業「總指數」（Services PMI）在 TradingView 搜不到（試過 `USNMPMI`、`USNMI`、`USSPMI`、`USSERPMI` 皆 invalid）；只有細項，其中 `USNMBA` 商業活動指數是 2008 年以前 ISM 服務業的主指標。
- `USCCI` 名稱寫 Conference Board，但起始 1952 年、最新值 46.3，比較像密大消費者信心（Conference Board 1967 年才開始）——**來源待查證，先不採用**。
- LME 金屬庫存：TradingView 只有 LME 期貨價格、沒有庫存；仍無免費來源。
- 尚未測：從 GitHub Actions（雲端 IP）連 TradingView 會不會被擋。

仍沒有免費來源：Conference Board CCI、LME 庫存。

## 2. 各指標方案

| 指標 | 講義來源 | 方案 | 序列 | 來源 | status | 畫面標示 |
|---|---|---|---|---|---|---|
| ISM 製造業 PMI [K 51–55] | Bloomberg `NAPMPMI` | **ISM 原序列，經 TradingView**（見決定點 B、C）；OECD 製造業信心當對照 | `TV_USBCOI`（月）＋`BSCICP03USM665S`（compare，替代） | TRADINGVIEW＋FRED | `ok` | 門檻線 50；對照序列標「替代」 |
| ISM 服務業 PMI [K 56–59] | Bloomberg `NAPMNMI` | 替代：ISM 服務業商業活動指數（總指數無來源） | `TV_USNMBA`（月） | TRADINGVIEW | `substitute` | 「替代：ISM 服務業商業活動細項，非綜合 PMI」；門檻線 50 |
| 消費者信心 CCI [K 11–15] | Bloomberg `CONCCONF` | 維持密大 `UMCSENT` 為主；加 OECD 消費者信心當對照（TradingView `USCCI` 來源存疑，不用） | `UMCSENT`（main）＋`CSCICP03USM665S`（compare，替代） | FRED | `ok` | 對照序列標「替代」 |
| 波羅的海乾散貨指數 BDI [K 94–98] | Bloomberg `BDIY` | **原序列，經 TradingView** | `TV_BDI`（`INDEX:BDI`，日） | TRADINGVIEW | `ok` | — |
| 美元指數 [K 99–102] | ICE DXY（Yahoo） | 主序列改用 Yahoo ICE DXY；Fed 廣義美元指數降為對照（見決定點 A） | `YF_DXY`（`DX-Y.NYB`，日）＋`DTWEXBGS`（compare） | YAHOO＋FRED | `ok` | — |
| LME 金屬庫存 [K 60–65] | Bloomberg `LSAH`／`LSNI` | 先不做：沒有免費來源 | — | — | `unavailable` | 「無免費資料來源」 |
| 黃金 [K 130–131] | Bloomberg `XAUUSD` | 替代：COMEX 黃金期貨（LBMA 現貨已自 FRED 下架） | `YF_GC`（`GC=F`，日） | YAHOO | `substitute` | 「替代：COMEX 期貨，非 LBMA 現貨」 |
| 原油庫存 [K 103–106] | Bloomberg `DOESCRUD` | EIA 官方原始序列：不含 SPR 的商業原油庫存 | `EIA_WCESTUS1`（週） | EIA | `ok` | — |

結果：可抓 7 個（其中 2 個替代）、不做 1 個（LME）。與前版相比，ISM 製造業改回原序列，ISM 服務業與 BDI 從「不做」變成可抓。

說明：DXY 與黃金在 TradingView 也有（`TVC:DXY`、`OANDA:XAUUSD` 現貨），但 Yahoo 已可用；為了少依賴非官方端點，TradingView 只補「其他地方都沒有」的序列。若 C 選 2，黃金可改用 `OANDA:XAUUSD` 現貨，免掉「期貨替代」標示。

## 3. 要你決定的點

**A. Yahoo 非官方端點的使用範圍**（日後可能被擋或改版；失敗時保留舊資料，不會壞網頁）

1. 黃金＋ICE DXY 都用 Yahoo ← **建議**（講義用的就是 ICE DXY）
2. 只有黃金用 Yahoo，美元指數維持 `DTWEXBGS` 替代

**B. ISM 製造業 PMI**

1. 用 TradingView 抓 ISM 原序列（1948–，門檻 50），OECD 當對照 ← **建議**（前提是 C 不選 3）
2. 只用 OECD 製造業信心替代（自動更新；刻度以 100 為基準，不是 50）
3. 手動維護 CSV（每月自己填 ISM 新聞稿數字）

**C. TradingView 非官方 WebSocket 的使用範圍**

風險：非公開協定，可能改版或封鎖；TradingView 使用條款原則上不允許自動抓取，ISM／Baltic Exchange 數據本身也有授權限制，公開放在 GitHub Pages 屬灰色地帶。GitHub Actions 能否連線尚未實測。

1. 只補「別處沒有」的 3 條：ISM 製造業、ISM 服務業商業活動、BDI ← **建議**
2. 再加黃金改用 `OANDA:XAUUSD` 現貨（DXY 仍用 Yahoo）
3. 不用 TradingView（回到前版：ISM 用 OECD 替代，ISM 服務業、BDI 不做）

## 4. 資料格式變更（相容舊資料）

- `series[].source` 新增 `"YAHOO"`、`"EIA"`、`"TRADINGVIEW"`（原本只有 `"FRED"`）。
- TradingView 序列另記原始代碼（如 `"tvSymbol": "ECONOMICS:USBCOI"`），抓取時用；`id` 用 `TV_` 前綴。
- `status` 新增 `"unavailable"`：沒有免費來源、不抓資料；`series` 為空陣列，`external` 保留講義原來源名稱。
- 非 FRED 序列檔名加來源前綴（`YF_`、`EIA_`、`TV_`），避免與 FRED 代碼撞名；檔案內容格式與現有 `data/series/<ID>.json` 相同。
- 抓取失敗：印出明確錯誤、不覆蓋舊檔（沿用 DA-02 做法）。TradingView 連線加逾時（約 30 秒），失敗不影響其他來源。

確認後這些格式規則會併入 `doc/decisions/SU-02-技術選型.md`。

## 5. 確認後的實作步驟

1. `tools/fetch-data.mjs`：依 `source` 分派 FRED／YAHOO／EIA／TRADINGVIEW，新增 Yahoo JSON、EIA HTML 表格解析，以及 TradingView WebSocket 抓取（Node 24 內建 `WebSocket`，不加套件；月線 `1M`、日線 `1D`，取收盤值）。
2. `data/indicators.json`：依第 2 節更新 8 個指標。
3. 執行腳本產生新序列檔。
4. 更新 `doc/decisions/SU-02-技術選型.md` 與 `doc/reference/指標清單.md`。
5. GitHub Actions 排程任務時，實測雲端 IP 能否連 TradingView；不行就在 Actions 跳過該來源、保留舊檔。

版號：0.3.0 → 0.4.0（MINOR）。派工：worker-opus 實作、verifier-sonnet 驗證。
