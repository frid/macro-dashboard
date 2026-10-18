# 總體經濟指標 Dashboard（Macro Indicator Dashboard）

依政大 EMBA「生技產業之投資分析與個案探討」課程，郭維裕教授講義《Fantastic Economic Indicators — Guide to the 50 Economic Indicators that Really Matter》建立的總體經濟指標儀表板。

- 線上網址：<https://frid.github.io/macro-dashboard/>
- 原始碼：[github.com/frid/macro-dashboard](https://github.com/frid/macro-dashboard)

> 開發中（版本見 `VERSION`，變更見 `CHANGELOG.md`，待辦見 `TODO.md`）。

## 指標分類

以 GDP = C + I + G + NX 為骨架：

| 代號 | 分類 | 例子 |
|---|---|---|
| C | 消費 Consumption | 汽車銷售、消費者信心、初領失業金、非農就業、Sahm Rule |
| I | 投資 Investment | 銅價、耐久財訂單、建照與新屋開工、ISM PMI |
| G | 政府 Government | 預算赤字、國債 |
| NX | 淨出口 Net Exports | 波羅的海乾散貨指數、美元指數、原油庫存 |
| MC | 多重成分 Multiple Components | 聯邦基金利率、SOFR、M2、新屋銷售、費城聯準會指數、殖利率曲線 |
| IFU | 通膨、恐慌與不確定 | 黃金、CPI、PPI、PCE、信用利差、TIPS 利差、VIX |

每個指標標示「領先／同時／落後」，完整清單見 [doc/reference/指標清單.md](doc/reference/指標清單.md)。

## 資料來源

所有序列的代碼、來源與替代狀況都記在 `data/indicators.json`（`indicators[].series[]`），抓下來的資料放在 `data/series/`，衍生序列放在 `data/derived/`。以下依來源整理。

### FRED（St. Louis Fed）

主要來源，使用公開 CSV 端點（`fredgraph.csv`），不需 API key。條款與使用說明見 <https://fred.stlouisfed.org/legal/>。

| 指標 | FRED 序列代碼 |
|---|---|
| 汽車銷售 | TOTALSA、ALTSALES |
| 消費者信心 | UMCSENT（**替代**：密大消費者信心，非 Conference Board CCI） |
| 就業不足 | U6RATE、LNS12032194 |
| 失業救濟申請 | ICSA、CCSA |
| 非農就業 | PAYEMS、UNRATE、CES0500000003 |
| Beveridge 曲線 | UNRATE、JTSJOR |
| Sahm 規則 | SAHMREALTIME、SAHMCURRENT、UNRATE |
| 銅價 | PCOPPUSDM |
| 耐久財訂單 | DGORDER、NEWORDER、ACDGNO、PCEDG |
| 建照與新屋開工 | PERMIT、HOUST |
| 預算赤字與國債 | MTSDS133FMS、FYFSGDA188S、GFDEBTN、GFDEGDQ188S |
| 美國債務與槓桿 | GFDEBTN、HMLBSHNO、MABSHNO、CMLBSHNO、SLOASM、REVOLSL、MVLOASM、GDP |
| 美元指數 | DTWEXBGS（Fed 廣義美元，非 DXY） |
| 聯邦基金利率 | DFF、DFEDTARU、DFEDTARL、UST_DGS10（FRED DGS10＋美國財政部最新日） |
| SOFR | SOFR |
| M2 貨幣供給 | M2SL、WM2NS、M2NS |
| 新屋銷售 | HSN1F |
| 費城聯準會製造業調查 | GACDFSA066MSFRBPHI |
| 殖利率曲線 | T10Y3M、T10Y2Y、T10Y2YM |
| CPI | CPIAUCSL、CPILFESL、CPIAUCNS |
| PPI | PPIFIS、PPIACO |
| PCE 物價指數 | PCEPI、PCEPILFE |
| 信用利差 | DBAA、DAAA、BAMLC0A4CBBB、BAA10YM |
| TED 利差 | SOFR、UST_DTB3（**替代**：TEDRATE 已於 2022-01 停更） |
| TIPS 利差 | T10YIE、T10YIEM |
| VIX 恐慌指數 | CBOE_VIX（Cboe 官方；對照 FRED VIXCLS） |
| 衰退期（圖上陰影） | USREC（NBER） |

### Yahoo Finance（非官方）

| 指標 | 代碼 | 說明 |
|---|---|---|
| 美元指數 | `DX-Y.NYB`（ICE DXY） | 主序列，講義所用指數 |
| 黃金 | `GC=F`（COMEX 黃金期貨） | **替代**：LBMA 現貨已自 FRED 下架 |

Yahoo 的 chart 介面非官方、僅供學習使用，可能隨時變更或失效。網站：<https://finance.yahoo.com/>。

### EIA（美國能源資訊署）

| 指標 | 代碼 | 說明 |
|---|---|---|
| 原油庫存 | `WCESTUS1`（不含 SPR 的商業原油庫存，千桶） | 取自 EIA 官網歷史資料頁 |

EIA 為美國政府公開資料，使用與再利用條款見 <https://www.eia.gov/about/copyrights_reuse.php>。

### TradingView（非官方）

| 指標 | 代碼 | 說明 |
|---|---|---|
| ISM 製造業 PMI | `ECONOMICS:USBCOI` | 主序列 |
| ISM 服務業 PMI | `ECONOMICS:USNMBA` | **替代**：商業活動細項，非綜合 PMI；平均高於綜合 PMI 約 2 點 |
| 波羅的海乾散貨指數 | `INDEX:BDI` | 主序列 |

TradingView 圖表資料的取得方式為非官方協定，僅供學習使用，可能隨時失效。網站：<https://www.tradingview.com/>。

### 無公開資料（unavailable）

- **LME 金屬庫存**（`status: unavailable`）：目錄中沒有任何序列代碼，無免費資料來源（Bloomberg LSAH／LSNI）。

### 替代序列一覽

畫面上會註明「替代」。

| 指標 | 替代序列 | 原因 |
|---|---|---|
| 消費者信心 | FRED `UMCSENT`（密大） | Conference Board CCI 無免費來源 |
| ISM 服務業 PMI | TradingView `USNMBA`（商業活動細項） | 綜合 PMI 無免費來源 |
| 黃金 | Yahoo `GC=F`（COMEX 期貨） | LBMA 現貨已自 FRED 下架 |
| TED 利差 | FRED `SOFR`、`UST_DTB3`（FRED `DTB3`＋美國財政部最新日） | TEDRATE 已於 2022-01 停更 |

替代方案的比較與選擇理由見 [doc/decisions/DA-04-非FRED指標方案.md](doc/decisions/DA-04-非FRED指標方案.md)。

### 衍生序列（`data/derived/`）

由 `tools/derive-data.mjs` 讀取 `data/series/` 計算，`source` 為 `DERIVED`，每個檔含 `inputs`、`formula` 與（部分）`check` 比對結果。

| 檔名 | 指標 | 算法 |
|---|---|---|
| `DRV_PAYEMS_MOM` | 非農就業 | 月增減（千人） |
| `DRV_PAYEMS_YOY` | 非農就業 | 年增率（%） |
| `DRV_SAHM` | Sahm 規則 | 自算（UNRATE 三個月移動平均，對照 SAHMREALTIME） |
| `DRV_CPI_YOY`、`DRV_CPICORE_YOY` | CPI | 年增率（整體、核心） |
| `DRV_PPI_YOY`、`DRV_PPIACO_YOY` | PPI | 年增率（最終需求、全商品） |
| `DRV_PCE_YOY`、`DRV_PCECORE_YOY` | PCE 物價指數 | 年增率（整體、核心） |
| `DRV_BBB_AAA` | 信用利差 | Baa − Aaa（百分點） |
| `DRV_DEFICIT_GDP` | 預算赤字與國債 | 近 12 個月赤字占 GDP（%） |
| `DRV_BEVERIDGE` | Beveridge 曲線 | 失業率與職缺率配對 |

以下為債務圖組衍生序列（DA-07，共 21 個：7 種債務 × 3 種序列）。講義對同一種債務以「水準／YoY／占 GDP／占 GDP 的 YoY」一組呈現 [K 69–91]；水準即 `data/series/` 的原序列，不另存衍生檔，這裡只列另外三種。

| 債務類別（序列代碼） | 年增率 | 占 GDP 比 | 占 GDP 比的年增率 |
|---|---|---|---|
| 聯邦總債務 `GFDEBTN` | `DRV_GFDEBTN_YOY` | `DRV_GFDEBTN_GDP` | `DRV_GFDEBTN_GDP_YOY` |
| 住宅房貸 `HMLBSHNO` | `DRV_HMLBSHNO_YOY` | `DRV_HMLBSHNO_GDP` | `DRV_HMLBSHNO_GDP_YOY` |
| 家庭持有房貸資產 `MABSHNO`（FRED 定義為資產面，非負債） | `DRV_MABSHNO_YOY` | `DRV_MABSHNO_GDP` | `DRV_MABSHNO_GDP_YOY` |
| 商業房貸 `CMLBSHNO` | `DRV_CMLBSHNO_YOY` | `DRV_CMLBSHNO_GDP` | `DRV_CMLBSHNO_GDP_YOY` |
| 學生貸款 `SLOASM` | `DRV_SLOASM_YOY` | `DRV_SLOASM_GDP` | `DRV_SLOASM_GDP_YOY` |
| 循環信用 `REVOLSL`（月資料） | `DRV_REVOLSL_YOY` | `DRV_REVOLSL_GDP` | `DRV_REVOLSL_GDP_YOY` |
| 汽車貸款 `MVLOASM` | `DRV_MVLOASM_YOY` | `DRV_MVLOASM_GDP` | `DRV_MVLOASM_GDP_YOY` |

三種序列的算法（輸入序列為債務代碼與 `GDP`）：

- **年增率**：本期 ÷ 12 個月前同期 − 1，×100（%）。
- **占 GDP 比**：債務（百萬美元）÷（所屬季名目 GDP（十億美元，季調年率）× 1000）× 100（%）。債務為存量、GDP 已是年率，不再年化。所屬季 GDP 尚未公布時改用最新一季 GDP，範圍記在 `check.gdp_fallback`。`REVOLSL` 為月資料，只取季末月（3／6／9／12 月）對該季 GDP。
- **占 GDP 比的年增率**：先以 4 位小數算占 GDP 比，再算其年增率（%）。

`DRV_GFDEBTN_GDP` 另以 FRED `GFDEGDQ188S`（聯邦債務占 GDP，季）同日期值做 `check` 比對；該序列只用於檢查，不列入 `inputs`。

## 技術

純前端靜態網頁（`index.html`＋`data/*.json`），資料由 `tools/fetch-data.mjs` 抓取更新，部署於 GitHub Pages（`main` 分支根目錄）。圖表庫為 Apache ECharts 6.1.0（CDN 載入），選型決策見 [doc/decisions/SU-02-技術選型.md](doc/decisions/SU-02-技術選型.md)。

## 專案結構

| 路徑 | 說明 |
|---|---|
| `index.html` | Dashboard 主頁（單檔頁面，含圖表與頁尾版號） |
| `data/indicators.json` | 指標目錄：分類、領先／同時／落後、資料來源、序列代碼、判讀規則、講義頁碼 |
| `data/series/` | 各序列的歷史資料 `<ID>.json`，由 `tools/fetch-data.mjs` 產生 |
| `data/derived/` | 衍生序列 `DRV_*.json`，由 `tools/derive-data.mjs` 計算 |
| `tools/` | 資料抓取與衍生計算腳本（`fetch-data.mjs`、`derive-data.mjs`） |
| `doc/decisions/` | 技術與資料方案的決策紀錄（如 SU-02 技術選型、DA-04 非 FRED 指標方案） |
| `doc/reference/` | 參考資料：指標清單、講義圖表頁摘要 |
| `assets/` | 靜態素材（頁首 Banner 圖） |

每個指標的詳細內容、判讀方式與講義頁碼，見 [doc/reference/指標清單.md](doc/reference/指標清單.md)。

## 更新資料

需 Node 24（使用內建的 `fetch`／`WebSocket`，零套件，不需 `npm install`）。

1. 抓取序列：`node tools/fetch-data.mjs`（抓 `indicators.json` 內所有序列）。也可指定代碼只更新部分，如 `node tools/fetch-data.mjs DGS10 TV_BDI`。
2. 重算衍生序列：`node tools/derive-data.mjs`（讀 `data/series/`，寫到 `data/derived/`；也可指定如 `DRV_SAHM`）。

注意事項：

- 某個序列抓取失敗時，不會建立或覆蓋該序列的舊檔，其餘序列照常寫入，結束碼為 1。
- 衍生序列所需的輸入檔缺少、或算出 0 筆時，同樣不建立或覆蓋舊檔，結束碼為 1。
- 因此建議先執行步驟 1，確認沒有 FAIL 後再執行步驟 2。

### 本機預覽

```sh
python3 -m http.server 8000
```

然後開啟 <http://localhost:8000/>。

直接雙擊 `index.html`（`file://`）時，瀏覽器會擋住頁面讀取 `data/*.json` 的請求，畫面會無法顯示資料，請改用上述本機伺服器。

## 聲明

指標分類與判讀觀念來自郭維裕教授課程講義；講義本身不隨本專案公開。本工具僅供學術與教學用途，不構成投資建議。
