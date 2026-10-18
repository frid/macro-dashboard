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

以 [FRED](https://fred.stlouisfed.org/)（St. Louis Fed）公開資料為主；非 FRED 指標以替代序列或手動資料補上，畫面上會註明。

## 技術

純前端靜態網頁（`index.html`＋`data/*.json`），資料由 `tools/fetch-data.mjs` 抓取更新，部署於 GitHub Pages（`main` 分支根目錄）。圖表庫為 Apache ECharts 6.1.0（CDN 載入），選型決策見 [doc/decisions/SU-02-技術選型.md](doc/decisions/SU-02-技術選型.md)。

## 更新資料

本機更新全部序列：`node tools/fetch-data.mjs`（需 Node 24；後面加序列代碼可只更新指定的，如 `node tools/fetch-data.mjs DGS10`）。
抓完再執行 `node tools/derive-data.mjs` 重算衍生序列（年增率、Sahm Rule、利差等，寫到 `data/derived/`）。

## 聲明

製作者：侯榮富 博士。

本站程式與摘要文字 © 2026 侯榮富；講義內容版權屬郭維裕教授（指標分類與判讀觀念來自其課程講義《Fantastic Economic Indicators》，講義本身不隨本專案公開，本站僅為自行摘要）；各項數據版權屬原始來源（FRED、EIA、Yahoo Finance、TradingView 等，見網頁「關於本站」）。

僅供課堂學習，不構成投資建議。引用或轉載本站內容請先經作者同意；數據請依各來源的使用條款。
