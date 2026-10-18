#!/usr/bin/env bash
# 任務分支 --no-ff 合併進 dev 並 push dev。
# 整段用 flock 排隊：多個 session 同時收尾時，一次只有一個能碰 dev 那份 index。
# flock 的鎖在程序結束時由系統釋放，不會像 index.lock 留下殘檔。
#
# 用法：merge-to-dev.sh <任務分支> <合併訊息檔>
#
# 結束碼：0 成功／1 前置條件不符／2 合併衝突（已 abort）／3 index 掉檔／4 等鎖逾時／5 push 失敗
set -uo pipefail

B="${1:?用法：merge-to-dev.sh <任務分支> <合併訊息檔>}"
MSG="${2:?用法：merge-to-dev.sh <任務分支> <合併訊息檔>}"
MSG="$(realpath "$MSG")"
HERE="$(cd "$(dirname "$0")" && pwd)"
LOCK=/tmp/macro-dashboard-dev-merge.lock   # 放 /tmp：Google Drive 上不支援 flock；背景 job 共用 /tmp

exec 9>"$LOCK"
if ! flock -n 9; then
  echo "別的 session 正在合併 dev，排隊等待（最多 ${DEV_MERGE_WAIT:-900} 秒）…"
  flock -w "${DEV_MERGE_WAIT:-900}" 9 || { echo "等 dev 合併鎖逾時" >&2; exit 4; }
fi
echo "取得 dev 合併鎖"

DEV_WT="$(git worktree list --porcelain | awk '/^worktree /{wt=substr($0,10)} $0=="branch refs/heads/dev"{print wt}')"
[ -n "$DEV_WT" ] || { echo "找不到 checkout 了 dev 的目錄" >&2; exit 1; }
g() { git -C "$DEV_WT" "$@"; }

# 殘留鎖與 index 掉檔：鎖還在（有人在用）就等，最多約 2 分鐘
for i in $(seq 1 60); do
  "$HERE/git-unlock-stale.sh" "$DEV_WT"; r=$?
  [ "$r" -eq 1 ] || break
  sleep 2
done
[ "$r" -eq 0 ] || { echo "dev 目錄的 index 狀態不對，停下（見上方訊息）" >&2; exit "$([ "$r" -eq 3 ] && echo 3 || echo 1)"; }

# 本機 dev 對齊遠端（使用者在 dev 目錄未 commit 的改動用 autostash 暫存）
if g remote | grep -qx origin; then
  g fetch origin dev || { echo "fetch origin dev 失敗" >&2; exit 1; }
  g merge --ff-only --autostash FETCH_HEAD || { echo "本機 dev 與 origin/dev 分岔，停下" >&2; exit 1; }
fi

echo "要合併的 commit："
git log --oneline "dev..$B"

stash_before="$(git stash list | grep -c autostash)"
if ! g merge --no-ff --autostash -F "$MSG" "$B"; then
  echo "合併衝突，已 abort：" >&2
  g diff --name-only --diff-filter=U >&2
  g merge --abort
  exit 2
fi
g log --oneline --graph -3

# autostash 套回失敗時會留在 stash 清單
if [ "$(git stash list | grep -c autostash)" -gt "$stash_before" ]; then
  echo "警告：dev 目錄原本未 commit 的改動套回時衝突，留在 git stash 清單（autostash），請手動處理" >&2
fi

"$HERE/git-unlock-stale.sh" "$DEV_WT" || { echo "合併後 dev 目錄 index 異常，未 push" >&2; exit 3; }

if g remote | grep -qx origin; then
  g push origin dev || { echo "push dev 失敗" >&2; exit 5; }
fi
echo "完成：dev = $(g rev-parse --short dev)"
