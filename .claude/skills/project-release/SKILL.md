---
name: project-release
description: >-
  把 dev 合併到 main 上線：確認 dev 與遠端同步、列出要上線的 commit 與 CHANGELOG、--no-ff 合併進 main、
  打 tag v<VERSION>、push main 與 tag，提醒看 GitHub Pages。只有使用者明確說「release」「上線」
  「/project-release」時使用；task 收尾（合併進 dev）用 task-release，不是這個。
metadata:
  version: "1.0.0"
---

# Project Release — `dev` → `main` 上線

`main` 是上線版（GitHub Pages 從 `main` 發佈）。**只有使用者明確說「release」或叫用本 skill 才做。**
全程用繁體中文回報。

---

## 🚨 硬規則

1. 不 force push；`main` 只能用 `--no-ff` 合併 `dev` 更新，不在 `main` 上直接改檔。
2. 本 skill 不升版號：版號在每個任務 `task-release` 時已升好，release 用 `dev` 上的 `VERSION` 打 tag。
3. **每一步分開跑、確認成功再做下一步**（不要用 `&&` 串一長串，避免合併失敗後 tag 照打）。
4. 出錯就停下回報，不硬試別的方法；打錯的 tag 只有在剛推、確認是自己這次打錯時才可刪掉重打，並向使用者說明。

---

## 步驟 0 — 位置與預檢

`main` 是在主目錄（不是 worktree）被 checkout 的，所以 release 在主目錄做。

- 目前在任務 worktree → 先用 ExitWorktree（`keep`）回到主目錄。
- 確認在 `main`、看工作目錄狀態：

  ```bash
  git branch --show-current          # 必須是 main
  git status --short
  ```

- 有未 commit 的改動：
  - 列出來回報；**不要 stash、不要丟棄、不要替使用者 commit**。
  - 若這些檔在 `main..dev` 之間也有改到（`git diff --name-only main dev`），合併會被拒 → 停下問使用者怎麼處理。
  - 沒有重疊 → 可以繼續（合併不會碰到那些檔），回報時註明。

---

## 步驟 1 — 同步與上線清單

```bash
git fetch origin
git rev-parse --short dev
git ls-remote origin dev main      # 本機 dev 應與遠端 dev 相同；本機 main 應與遠端 main 相同
git log --oneline main..dev        # 要上線的 commit
git show dev:VERSION               # 本次 tag 版號
git tag -l "v$(git show dev:VERSION | tr -d '[:space:]')"   # 必須是空的
```

- 本機 `dev` 落後遠端 → `git fetch origin dev:dev` 對齊；分岔（非 fast-forward）→ 停下回報。
- `main..dev` 是空的 → 沒有東西可上線，回報後結束。
- tag 已存在 → 表示版號沒升，停下回報（不覆蓋 tag）。
- 把 `main..dev` 的 commit 清單與 `CHANGELOG.md` 自上次 tag 以來的段落列給使用者看。

---

## 步驟 2 — 合併、打 tag

```bash
V="$(git show dev:VERSION | tr -d '[:space:]')"
printf '%s\n\n%s\n' "Release v$V：合併 dev 到 main" "<Co-Authored-By 行>" > "$CLAUDE_JOB_DIR/tmp/release_msg.txt"
git merge --no-ff -F "$CLAUDE_JOB_DIR/tmp/release_msg.txt" dev
git log --oneline --graph -3       # 確認合併 commit 在 main 頂端
cat VERSION                        # 必須等於 $V
git tag "v$V"
git rev-parse --short "v$V^{commit}"   # 必須是剛才的合併 commit
```

- Co-Authored-By 行用當前 session system-reminder 給的那行。
- 有衝突 → `git merge --abort`，回報衝突檔案。
- 背景 job 的 `$CLAUDE_JOB_DIR` 不存在時，訊息檔放 `/tmp`。

---

## 步驟 3 — Push

```bash
git push origin main
git push origin "v$V"
git ls-remote origin main "refs/tags/v$V"   # 兩者都應指向合併 commit
```

push 失敗 → 據實回報。

---

## 步驟 4 — 回報

- 上線版號、合併 commit hash、tag
- 本次上線包含的任務（`main..dev` 清單／CHANGELOG 段落）
- 主目錄未 commit 的改動是否仍在、有沒有受影響
- 提醒：GitHub Pages 約幾分鐘後更新，網址 <https://frid.github.io/macro-dashboard/>

---

## 版本紀錄

| 版號 | 日期 | 變更 |
|---|---|---|
| 1.0.0 | 2026-10-18 | SU-04 建立：`dev` → `main` 上線流程（`--no-ff` 合併、tag `v<VERSION>`、push） |
