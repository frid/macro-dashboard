# CHANGELOG

格式：`## 版號 — YYYY-MM-DD`，條列「任務代號 摘要」。新版本加在最上面。版號規則見 CLAUDE.md §版本。

## 0.5.0 — 2026-10-18
- UI-01 新增 Dashboard 主頁 `index.html`：六大分類分區與 32 張指標卡片（最新值、較前期變動、迷你走勢、L／C／G 標籤、資料截至日），暫行顯示規則（NFP 月增減、物價與 M2 年增率、利差），待補與替代標示，頁尾版號

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
