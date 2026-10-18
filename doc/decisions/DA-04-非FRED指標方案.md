# DA-04 非 FRED 指標方案（草案，待確認）

- 狀態：**草案**——等使用者確認「要你決定的點」A、B 後才動工
- 日期：2026-10-18
- 範圍：`data/indicators.json` 中 `status: "pending"` 的 7 個指標，加上已用替代序列的美元指數，共 8 個
- 相關：`doc/reference/指標清單.md`（狀態／替代欄）、`doc/decisions/SU-02-技術選型.md`（資料格式）

## 1. 來源實測（2026-10-18，WSL 環境以 curl 測試）

| 來源 | 端點 | 結果 | 備註 |
|---|---|---|---|
| EIA 官網網頁 | `eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=WCESTUS1&f=W` | ✅ 200，HTML 表格 | 最新一筆 2026-10-09：415,577 千桶；不需 API key |
| EIA 官網 xls | `eia.gov/dnav/pet/hist_xls/WCESTUS1w.xls` | ✅ 200，舊版 Excel（BIFF） | 零套件難解析，不採用 |
| Yahoo chart API | `query1.finance.yahoo.com/v8/finance/chart/DX-Y.NYB` | ✅ 200，JSON | ICE 美元指數（講義用的 DXY） |
| Yahoo chart API | `…/chart/GC=F` | ✅ 200，JSON | COMEX 黃金期貨 |
| Yahoo chart API | `…/chart/^BDI` | ❌ 404 | Yahoo 沒有 BDI |
| stooq CSV | `stooq.com/q/d/l/?s=xauusd` | ❌ 瀏覽器驗證頁 | 需要 JavaScript，腳本抓不到 |
| FRED CSV | `fredgraph.csv?id=…` | ⚠️ 本次環境逾時 | DA-02 用同一端點正常；OECD 序列代碼待 worker 實抓確認 |

沒有免費來源：ISM PMI（ISM 版權資料）、Conference Board CCI、BDI（Baltic Exchange）、LME 庫存（Bloomberg／LME 付費）。

## 2. 各指標方案

| 指標 | 講義來源 | 方案 | 序列 | 來源 | status | 畫面標示 |
|---|---|---|---|---|---|---|
| ISM 製造業 PMI [K 51–55] | Bloomberg `NAPMPMI` | 替代：OECD 美國製造業信心（見決定點 B） | `BSCICP03USM665S`（月） | FRED | `substitute` | 「替代」；門檻線改為 100（長期平均），不用 50 |
| ISM 服務業 PMI [K 56–59] | Bloomberg `NAPMNMI` | 先不做：沒有免費的對應序列 | — | — | `unavailable` | 「無免費資料來源」 |
| 消費者信心 CCI [K 11–15] | Bloomberg `CONCCONF` | 維持密大 `UMCSENT` 為主；加 OECD 消費者信心當對照 | `UMCSENT`（main）＋`CSCICP03USM665S`（compare，替代） | FRED | `ok` | 對照序列標「替代」 |
| 波羅的海乾散貨指數 BDI [K 94–98] | Bloomberg `BDIY` | 先不做：沒有免費來源 | — | — | `unavailable` | 「無免費資料來源」 |
| 美元指數 [K 99–102] | ICE DXY（Yahoo） | 主序列改用 Yahoo ICE DXY；Fed 廣義美元指數降為對照（見決定點 A） | `YF_DXY`（`DX-Y.NYB`，日）＋`DTWEXBGS`（compare） | YAHOO＋FRED | `ok` | — |
| LME 金屬庫存 [K 60–65] | Bloomberg `LSAH`／`LSNI` | 先不做：沒有免費來源 | — | — | `unavailable` | 「無免費資料來源」 |
| 黃金 [K 130–131] | Bloomberg `XAUUSD` | 替代：COMEX 黃金期貨（LBMA 現貨已自 FRED 下架） | `YF_GC`（`GC=F`，日） | YAHOO | `substitute` | 「替代：COMEX 期貨，非 LBMA 現貨」 |
| 原油庫存 [K 103–106] | Bloomberg `DOESCRUD` | EIA 官方原始序列：不含 SPR 的商業原油庫存 | `EIA_WCESTUS1`（週） | EIA | `ok` | — |

結果：可抓 5 個（其中 2 個替代）、明確不做 3 個；美元指數由替代改回講義原序列。

## 3. 要你決定的點

**A. Yahoo 非官方端點的使用範圍**（日後可能被擋或改版；失敗時保留舊資料，不會壞網頁）

1. 黃金＋ICE DXY 都用 Yahoo ← **建議**（講義用的就是 ICE DXY）
2. 只有黃金用 Yahoo，美元指數維持 `DTWEXBGS` 替代

**B. ISM 製造業 PMI**

1. 用 OECD 製造業信心替代（自動更新；刻度以 100 為基準，不是 50） ← **建議**
2. 手動維護 CSV（每月自己填 ISM 新聞稿數字，歷史資料要一次補齊；選這個的話 ISM 服務業也可一併手動）

## 4. 資料格式變更（相容舊資料）

- `series[].source` 新增 `"YAHOO"`、`"EIA"`（原本只有 `"FRED"`）。
- `status` 新增 `"unavailable"`：沒有免費來源、不抓資料；`series` 為空陣列，`external` 保留講義原來源名稱。
- 非 FRED 序列檔名加來源前綴（`YF_`、`EIA_`），避免與 FRED 代碼撞名；檔案內容格式與現有 `data/series/<ID>.json` 相同。
- 抓取失敗：印出明確錯誤、不覆蓋舊檔（沿用 DA-02 做法）。

確認後這些格式規則會併入 `doc/decisions/SU-02-技術選型.md`。

## 5. 確認後的實作步驟

1. `tools/fetch-data.mjs`：依 `source` 分派 FRED／YAHOO／EIA，新增 Yahoo JSON 與 EIA HTML 表格解析。
2. `data/indicators.json`：依第 2 節更新 8 個指標。
3. 執行腳本產生新序列檔。
4. 更新 `doc/decisions/SU-02-技術選型.md` 與 `doc/reference/指標清單.md`。

版號：0.3.0 → 0.4.0（MINOR）。派工：worker-opus 實作、verifier-sonnet 驗證。
