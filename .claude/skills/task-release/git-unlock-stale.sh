#!/usr/bin/env bash
# 清掉殘留的 index.lock，並檢查 index 是否掉檔（Google Drive 上 git 寫入中斷的後遺症）。
#
# 用法：git-unlock-stale.sh [worktree 路徑…]
#   不給路徑 → 檢查目前的 worktree，以及 checkout 了 dev 的目錄。
#
# 結束碼：
#   0  沒有鎖，或殘留鎖已刪除；index 正常
#   1  鎖還在且可能有人在用（鎖太新，或這個 worktree 有 git 程序在跑）→ 等一下再試
#   3  index 掉檔：同一路徑同時是「已 stage 刪除」與「未追蹤」→ 確認後 git add 補回
set -u
export GIT_OPTIONAL_LOCKS=0

MAX_AGE="${GIT_LOCK_MAX_AGE:-120}"   # 鎖檔超過幾秒且沒有 git 程序 → 視為殘留

# 只算跟這個 worktree 有關的 git：cwd 在 worktree 內（不含其下的 .claude/worktrees/），或用 -C 指向它。
# 其他 session 在別的 worktree 跑的 git 用的是自己的 index，不算。
git_running() {
  local wt="$1" p cwd
  for p in $(pgrep -x git); do
    cwd="$(readlink "/proc/$p/cwd" 2>/dev/null)" || continue
    if [ "$cwd" = "$wt" ] || { [[ "$cwd" == "$wt"/* ]] && [[ "$cwd" != "$wt"/.claude/worktrees/* ]]; }; then
      return 0
    fi
    tr '\0' '\n' <"/proc/$p/cmdline" 2>/dev/null | grep -Fxq -- "$wt" && return 0
  done
  # Windows 端的 git（VS Code、GitHub Desktop）在 WSL 的 ps 看不到
  command -v tasklist.exe >/dev/null 2>&1 &&
    tasklist.exe 2>/dev/null | grep -qi '^git\.exe' && return 0
  return 1
}

if [ "$#" -gt 0 ]; then
  TARGETS=("$@")
else
  TARGETS=("$(git rev-parse --show-toplevel)")
  DEV_WT="$(git worktree list --porcelain | awk '/^worktree /{wt=substr($0,10)} $0=="branch refs/heads/dev"{print wt}')"
  [ -n "$DEV_WT" ] && [ "$DEV_WT" != "${TARGETS[0]}" ] && TARGETS+=("$DEV_WT")
fi

rc=0
for wt in "${TARGETS[@]}"; do
  wt="$(git -C "$wt" rev-parse --show-toplevel)" || { rc=1; continue; }
  lock="$(git -C "$wt" rev-parse --path-format=absolute --git-path index.lock)"
  if [ -e "$lock" ]; then
    age=$(( $(date +%s) - $(stat -c %Y "$lock") ))
    if [ "$age" -ge "$MAX_AGE" ] && ! git_running "$wt"; then
      rm -f "$lock" && echo "已刪除殘留鎖（${age} 秒、無 git 程序）：$lock"
    else
      echo "鎖還在（${age} 秒，可能有人在用）：$lock"
      rc=1
      continue
    fi
  fi

  # 同一路徑「D 」＋「??」＝ HEAD 有、磁碟有、index 卻沒有
  st="$(git -C "$wt" -c core.quotePath=false status --porcelain --untracked-files=all)"
  dropped="$(comm -12 \
    <(printf '%s\n' "$st" | awk '/^D  /{print substr($0,4)}' | sort) \
    <(printf '%s\n' "$st" | awk '/^\?\? /{print substr($0,4)}' | sort))"
  if [ -n "$dropped" ]; then
    n="$(printf '%s\n' "$dropped" | wc -l)"
    echo "index 掉檔（$wt，${n} 個）："
    printf '  %s\n' "$dropped" | head -20
    echo "  確認不是有意刪除後補回：git -C \"$wt\" add -- <上列檔案>"
    [ "$rc" -eq 0 ] && rc=3
  fi
done
exit "$rc"
