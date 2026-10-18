---
name: task-release
description: >-
  任務做完並驗證後的收尾流程：勾選 TODO.md、更新 VERSION 與 CHANGELOG.md、更新 index.html 頁尾版號與
  「最後更新日期」、只 stage 本任務的檔、commit、push 任務分支，再 --no-ff 合併進 dev 並 push dev。
  當 task-next 走到收尾、或使用者說「收尾」「commit」「/task-release」時使用。
  不會動 main——dev 合併到 main 要等使用者說「release」，走 project-release skill。
metadata:
  version: "1.2.0"
---

# Task Release — 任務收尾

一任務一 commit。只提交本任務的改動，不夾帶無關變更。全程用繁體中文回報。

---

## 步驟 0 — 預檢

```bash
S="$(git rev-parse --show-toplevel)/.claude/skills/task-release"   # 本 skill 的腳本目錄
bash "$S/git-unlock-stale.sh"
git branch --show-current
git status --short
git diff --stat
```

- `git-unlock-stale.sh`：刪掉殘留的 `index.lock`（放超過 2 分鐘且 WSL／Windows 都沒有 git 程序），並檢查 index 掉檔。結束碼 1＝鎖還有人在用，等一下再跑；3＝index 掉檔（同一檔同時是 `D ` 與 `??`），確認不是本任務有意刪除後 `git add` 補回。
- 在 `main` 或 `dev` 上 → 停下，不 commit（收尾只在任務 worktree 上做）。
- 有不屬於本任務的改動 → 不 stage，有疑問就問使用者。

---

## 步驟 1 — 更新 TODO.md

改前先重讀最新版。

- 狀態：`[ ]` → `[~]` → `[x]`；完成項行尾加 `（完成 YYYY-MM-DD）`，主 task 全部完成後移到 `## Complete`。
- 父項還沒全做完：只勾完成的子項，父項維持 `[~]`。
- 過程中冒出的新待辦 → 照「# 規則」編號後加進去。

---

## 步驟 2 — 更新版號

依 CLAUDE.md §版本：

- 子 task 完成：不動版號（父項完成時一次升）。
- 主 task 完成：新功能 → MINOR＋1（PATCH 歸 0）；修正／文件／小調整 → PATCH＋1。1.0.0 之前不動 MAJOR。
- 改 `VERSION`（單行版號）。
- `CHANGELOG.md` 最上方（說明段之後）加：

  ```
  ## <新版號> — YYYY-MM-DD
  - <代號> <一句摘要>
  ```

---

## 步驟 3 — 更新網頁頁尾

`index.html` 頁尾有版號與日期（UI-06 建立後才有；還沒有就略過）：

```bash
grep -n "最後更新日期\|版本" index.html
```

版號改成 `VERSION` 的值、日期改今天（`YYYY/MM/DD`）。只有真的改了 `index.html` 或 `data/` 才更新日期。

---

## 步驟 4 — Stage 與 Commit

- 只 `git add` 本任務的檔（通常是程式檔、`TODO.md`、`VERSION`、`CHANGELOG.md`，以及任務用到的 `assets/` 圖片）。
- 不要 add `Docs/Ref/*.pdf`（已在 .gitignore）。
- commit 訊息寫到暫存檔再 `git commit -F`（背景 job 用 `$CLAUDE_JOB_DIR/tmp/commit_msg.txt`）。
- 格式：第一行 `<代號> <一句摘要>`；內文條列做了什麼、怎麼驗證的、版號。
- 結尾加當前 session system-reminder 給的 Co-Authored-By 行（不要寫死舊模型名）。

commit 前再跑一次 `bash "$S/git-unlock-stale.sh"`：結束碼 3 → 先補回掉的檔，否則 commit 會把它們從版本裡刪掉。

```bash
git commit -F "$CLAUDE_JOB_DIR/tmp/commit_msg.txt"
git log --oneline -1
```

---

## 步驟 5 — Push 分支

```bash
git remote -v
git push -u origin "$(git branch --show-current)"
```

- 還沒有 remote（SU-01 未完成）→ 略過並在回報註明。
- **絕不 push `main`、不 force push。**
- push 失敗 → 據實回報，不硬試別的方法。
- Google Drive 路徑下 `-u` 會因寫 `.git/config` 失敗而報錯，可改用 `git push origin <branch>`（CLAUDE.md §Git 規則）。

---

## 步驟 6 — 合併進 `dev`

任務 worktree 收尾的最後一步：把任務分支 `--no-ff` 合併進 `dev`。`dev` checkout 在主目錄，多個 session 收尾都要用主目錄那份 index，同時合併就會互搶 `index.lock`。所以**一律用 `merge-to-dev.sh`**，不要自己 `git switch dev`／`git merge`。腳本會用 `flock` 排隊（後到的等前一個做完），依序做：

1. 清殘留鎖、檢查主目錄 index。
2. 本機 `dev` fast-forward 對齊 `origin/dev`。
3. `merge --no-ff --autostash`（主目錄裡使用者未 commit 的改動，例如 `TODO.md`，會暫存後套回）。
4. 合併後再檢查一次 index，然後 `push origin dev`。

不用離開任務 worktree。

```bash
B="$(git branch --show-current)"
printf '%s\n\n%s\n' "Merge <代號> <一句摘要>（v<VERSION>）" "<Co-Authored-By 行>" > "$CLAUDE_JOB_DIR/tmp/merge_msg.txt"
bash "$S/merge-to-dev.sh" "$B" "$CLAUDE_JOB_DIR/tmp/merge_msg.txt"
```

Bash 工具的 timeout 設 `600000`：排隊最多等 15 分鐘，逾時就再跑一次。

依結束碼處理：

| 碼 | 意思 | 怎麼做 |
|---|---|---|
| 0 | 已合併並 push | 回報 |
| 1 | 前置條件不符（找不到 `dev` 目錄、鎖一直被佔、本機 `dev` 與遠端分岔） | 照訊息回報使用者 |
| 2 | 合併衝突（已 abort，主目錄不變） | 在任務 worktree `git merge dev` 解衝突、重新驗證後再跑腳本；衝突不好判斷就問使用者 |
| 3 | 主目錄 index 掉檔 | 回報使用者，不要替使用者 `git add` 主目錄 |
| 4 | 等鎖逾時 | 再跑一次 |
| 5 | push 失敗 | 據實回報，不硬試別的方法 |

輸出出現「autostash」警告 → 使用者原本未 commit 的改動沒能自動套回，要回報使用者。

---

## 步驟 7 — 回報

- 版號、任務 commit hash、任務分支名、納入哪些檔
- `dev` 合併 commit hash、`dev` 是否已 push
- 驗證摘要
- 下一步：「要上線（`dev` → `main`）請說『release』」

`main` 的合併、打 tag 不在本 skill 範圍，見 `project-release` skill。

---

## 版本紀錄

| 版號 | 日期 | 變更 |
|---|---|---|
| 1.2.0 | 2026-10-18 | 防 `index.lock` 互卡：合併 `dev` 改用 `merge-to-dev.sh`（`flock` 排隊）；`git-unlock-stale.sh` 清殘留鎖、檢查 index 掉檔 |
| 1.1.0 | 2026-10-18 | SU-04 收尾改成合併進 `dev`（含 Google Drive 上 index.lock 衝突的處理）；`main` 合併移到 `project-release` |
| 1.0.0 | 2026-10-18 | 建立：沿用 strategy-matrix `task-release` 1.0.0，加入 VERSION／CHANGELOG 升版與 merge 打 tag |
