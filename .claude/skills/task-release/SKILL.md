---
name: task-release
description: >-
  任務做完並驗證後的收尾流程：勾選 TODO.md、更新 VERSION 與 CHANGELOG.md、更新 index.html 頁尾版號與
  「最後更新日期」、只 stage 本任務的檔、commit、push 分支。當 task-next 走到收尾、或使用者說
  「收尾」「commit」「/task-release」時使用。不會合併回 main——使用者明確說「merge」才另外做。
metadata:
  version: "1.0.0"
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

- 在 `main` 上 → 停下，不 commit。
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
- **只 push 分支，絕不 push `main`、不 force push。**
- push 失敗 → 據實回報，不硬試別的方法。

---

## 步驟 6 — 回報

- 版號、commit hash、分支名、納入哪些檔
- 驗證摘要
- 下一步：「要上線請說『merge』」

---

## 合併回 main（只有使用者說「merge」才做）

1. 先讓使用者確認 commit 清單：`git log --oneline main..<branch>`。
2. 合併後打 tag：`git tag v<VERSION>`，push `main` 與 tag。
3. 有 GitHub Pages 時提醒使用者過幾分鐘去看線上版。

---

## 版本紀錄

| 版號 | 日期 | 變更 |
|---|---|---|
| 1.0.0 | 2026-10-18 | 建立：沿用 strategy-matrix `task-release` 1.0.0，加入 VERSION／CHANGELOG 升版與 merge 打 tag |
