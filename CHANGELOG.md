# CHANGELOG

格式：`## 版號 — YYYY-MM-DD`，條列「任務代號 摘要」。新版本加在最上面。版號規則見 CLAUDE.md §版本。

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
