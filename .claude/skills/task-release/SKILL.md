---
name: task-release
description: >-
  任務做完並驗證後的收尾流程：勾選 TODO.md、更新 VERSION 與 CHANGELOG.md、更新 index.html 頁尾版號與
  「最後更新日期」、只 stage 本任務的檔、commit、push 任務分支，再 --no-ff 合併進 dev 並 push dev。
  當 task-next 走到收尾、或使用者說「收尾」「commit」「/task-release」時使用。
  不會動 main——dev 合併到 main 要等使用者說「release」，走 project-release skill。
metadata:
  version: "1.1.0"
---

# Task Release — 任務收尾

一任務一 commit。只提交本任務的改動，不夾帶無關變更。全程用繁體中文回報。

---

## 步驟 0 — 預檢

```bash
git branch --show-current
git status --short
git diff --stat
```

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

任務 worktree 收尾的最後一步：把任務分支 `--no-ff` 合併進 `dev`。`dev` 沒有在任何 worktree 被 checkout，所以直接在任務 worktree 切過去合併。**每一步分開跑、確認成功再做下一步**（不要用 `&&` 串一長串，避免前面失敗後面照跑）。

```bash
B="$(git branch --show-current)"                      # 任務分支名，記下來
git fetch origin dev:dev                              # 本機 dev 對齊遠端；非 fast-forward → 停下回報
git log --oneline dev.."$B"                           # 要合併的 commit 清單
printf '%s\n\n%s\n' "Merge <代號> <一句摘要>（v<VERSION>）" "<Co-Authored-By 行>" > "$CLAUDE_JOB_DIR/tmp/merge_msg.txt"
git switch dev
git merge --no-ff -F "$CLAUDE_JOB_DIR/tmp/merge_msg.txt" "$B"
git log --oneline --graph -3                          # 確認合併 commit 在 dev 頂端
git push origin dev
git switch "$B"                                       # 切回任務分支，讓 worktree 維持原狀
```

- 有衝突 → `git merge --abort`，切回任務分支，回報衝突檔案，問使用者怎麼處理。
- **`index.lock: File exists`**：`/mnt/g`（Google Drive）上 git 很慢，Claude Code 在背景跑的 `git status --porcelain` 會暫時佔住 `index.lock`，使 `add`／`commit`／`switch`／`merge` 失敗（事後 `ls` 常看不到鎖檔）。**不要手動刪鎖檔**，先等背景的 git 跑完再重試：

  ```bash
  for i in $(seq 1 60); do pgrep -f "git .*status" >/dev/null || break; sleep 1; done
  ```

  一直撞到的話，若 `dev` 是任務分支的祖先（`git merge-base --is-ancestor dev "$B"`），可不經 index 建合併 commit，結果與 `--no-ff` 相同：

  ```bash
  OLD="$(git rev-parse dev)"
  M="$(git commit-tree "$B^{tree}" -p dev -p "$B" -F "$CLAUDE_JOB_DIR/tmp/merge_msg.txt")"
  git update-ref refs/heads/dev "$M" "$OLD"
  git push origin dev
  ```

  `dev` 不是祖先（期間有別的任務先合進 `dev`）→ 不要用這招，回報使用者。

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
| 1.1.0 | 2026-10-18 | SU-04 收尾改成合併進 `dev`（含 Google Drive 上 index.lock 衝突的處理）；`main` 合併移到 `project-release` |
| 1.0.0 | 2026-10-18 | 建立：沿用 strategy-matrix `task-release` 1.0.0，加入 VERSION／CHANGELOG 升版與 merge 打 tag |
