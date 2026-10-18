# macro-dashboard

總體經濟指標 Dashboard。依政大 EMBA「生技產業之投資分析與個案探討」郭維裕教授講義《Fantastic Economic Indicators》（`Docs/Ref/`）建立，指標依 GDP = C + I + G + NX 分類，另加 MC（多重成分）與 IFU（通膨／恐慌／不確定）。

## 架構（SU-02 定案）

- 純前端靜態網頁，預計部署 GitHub Pages；不需後端。
- `index.html`：Dashboard 主頁（圖表庫 Apache ECharts 6.1.0（cdnjs，含 SRI），鎖定確切版號）。
- 技術選型決策與理由：`doc/decisions/SU-02-技術選型.md`。
- `data/indicators.json`：指標目錄（分類、領先／同時／落後、資料來源、序列代碼、公布時間、判讀規則、講義頁碼）。
- `data/series/<ID>.json`：各序列的歷史資料，由 `tools/fetch-data.mjs` 抓取產生（FRED 公開 CSV 端點，不需 API key）。
- 之後用 GitHub Actions 排程更新 `data/series/`。
- 指標清單與資料來源對照：`doc/reference/指標清單.md`；講義摘要：`doc/reference/`。

## Git 規則

- 主分支是 `main`。
- 修改一律在新的 branch／worktree 上做，不要直接改 `main`。
- **使用者明確說「merge」才可以合併回 `main`。** 在那之前只能 commit／push 分支。
- `Docs/Ref/*.pdf` 不進版控（檔案超過 GitHub 100MB 上限，且為課程講義未公開）。
- 不 force push、不 push `main`（merge 由使用者明確指示後才做）。
- **已知限制**：專案在 Google Drive 掛載路徑（`/mnt/g`），WSL 下凡是寫 `.git/config` 的指令都會報 `chmod on .git/config.lock failed`（`git config`、`push -u` 設上游、刪分支時的設定清理）。commit、branch、worktree 正常。要改設定就在 Windows 端的 git 做，或把設定寫在指令列（`git -c key=value …`）；push 用 `git push origin <branch>`，不要依賴 `-u`。

## 版本

- 版號放在 `VERSION`（SemVer：`MAJOR.MINOR.PATCH`），網頁頁尾顯示同一個版號。
- 每完成一個主 task 收尾時更新版號：新功能 → MINOR＋1；修正／文件／小調整 → PATCH＋1；1.0.0 之前不動 MAJOR，1.0.0 由使用者宣布。
- 每次改版在 `CHANGELOG.md` 最上方加一段（版號、日期、任務代號、摘要）。

## 內容規則

- 講義內容用自己的話摘要，不逐字抄錄；引用標註講義頁碼，如 `[K 51]`（K = 郭維裕講義，頁碼為整份 193 頁的頁碼）。
- 每個指標都要標資料來源與最後更新日期；用替代序列時要在畫面上註明「替代」。
- 畫面文字用繁體中文，指標英文原名與序列代碼保留。

## 溝通
- 用繁體中文回覆。

## 工作流程

待辦事項都記在 `TODO.md`（編號規則見該檔頂端「# 規則」）。做 TODO 的任務一律走下面流程：

1. **接任務** → 用 `task-next` skill（使用者說「下一步」「接著做」「/task-next」時）。
   - 先掃 `TODO.md`，把沒編號的項目自動編號。
   - 一次只挑一項（使用者沒指定就取第一個 `[ ]`）；有附圖要先看圖。
2. **先規劃再執行** → 先把「目標／動作／會動到／驗證方式」寫給使用者看，**使用者點頭後才改檔**。
3. **執行（交 subagent）** → 開工時把該項標成 `[~]`。主 session 不直接改程式檔（`index.html`、`tools/`、`data/`）：讀程式派 `Explore`，改檔派一個 worker subagent，由 Claude 依任務自選（小改 `worker-haiku`／一般功能 `worker-sonnet`／動到資料結構或多處連動 `worker-opus`；定義在 `.claude/agents/`）。
4. **驗證（另派 subagent）** → 改的人不驗自己：另派 `verifier-sonnet`（不能改檔）做 JS 語法檢查（`node --check`）＋資料檔 JSON 檢查＋ headless Chrome 截圖；需要手點的功能請使用者本機確認。結果據實回報，FAIL 不收尾。
5. **收尾** → 用 `task-release` skill：`TODO.md` 標 `[x]` 加完成日、更新 `VERSION`／`CHANGELOG.md`／頁尾版號與「最後更新日期」、commit、push 分支。
6. **停下** → 回報 commit／分支／版號，等使用者決定下一步。要上線必須等使用者說「merge」。

**用量守六成**：主 session context 用量超過約 60% → 先 commit 目前進度，提醒使用者 `/clear` 後再用 `task-next` 接著做。
