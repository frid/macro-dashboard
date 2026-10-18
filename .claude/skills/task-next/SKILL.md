---
name: task-next
description: >-
  從 TODO.md 挑下一項未完成任務，先補編號、先寫計畫給使用者確認，點頭後才派 subagent 改檔，
  改完另派驗證，再交給 task-release 收尾。當使用者說「下一步」「接著做」「做下一項」
  「/task-next」「把 TODO 的 DA-01 做掉」時使用。
  硬規則：一次只做一項；先規劃、等使用者點頭再執行；任務 worktree 從 dev 開出，不在 main／dev 上改；
  收尾合併進 dev，使用者沒說「release」不動 main。
metadata:
  version: "1.1.0"
---

# Task Next — 從 TODO.md 接手下一項任務

流程：**補編號 → 選一項 → 寫計畫 → 等點頭 → 執行 → 驗證 → 收尾**。
一次只做一項。全程用繁體中文跟使用者溝通。

---

## 🚨 硬規則

1. **先規劃再執行**：步驟 3 的計畫沒被使用者點頭前，不改任何檔（補編號除外，見步驟 1）。
2. **一次一項**：上一項沒 commit，不開下一項。
3. **不在 `main`／`dev` 上改**：必須在從 `dev` 開出的任務 worktree 上（CLAUDE.md §Git 規則）。
4. **任務收尾合併進 `dev`；使用者沒明確說「release」，不動 `main`**（release 走 `project-release` skill）。
5. **要刪檔、搬檔、改檔名，或規格有兩種以上合理解讀 → 停下問使用者**，不猜。
6. **改檔、驗證都交給 subagent**：主 session 只負責讀 TODO、寫計畫、派工、檢查成果、收尾（`TODO.md`／`VERSION`／`CHANGELOG.md`／頁尾版號與日期／commit 由主 session 做）。主 session 不直接改 `index.html`、`tools/`、`data/`，連「只有一行」也一樣。
7. **主 session 用量守在六成內**：context 用量超過約 60% → 先收尾（commit），提醒使用者 `/clear` 後再用 `task-next` 接著做。

---

## 步驟 1 — 讀 TODO.md，補編號

```bash
cat TODO.md
git status --short
git branch --show-current
```

- 若目前在 `main` 或 `dev` → 停下，請使用者同意後用 EnterWorktree 開 worktree（名稱用任務代號，如 `da-02-fetch`）。
- **worktree 必須從 `dev` 開出**：EnterWorktree 預設從 `origin/main` 開分支，進去後立刻對齊 `dev`（剛建好、還沒改任何檔時才可以這樣做）：

  ```bash
  git fetch origin dev:dev          # 本機 dev 對齊遠端（非 fast-forward 會失敗 → 停下回報）
  git status --short                # 必須是空的
  git reset --hard dev              # 新分支起點改成 dev
  git log --oneline -1              # 確認與 dev 同一個 commit
  ```
- 有別人未 commit 的改動（`TODO.md` 以外）→ 先回報，別動。

**補編號**：規則以 TODO.md 頂端「# 規則」節為準，動手前重讀。

- 主 task：`- [ ] XX-NN 標題`；子 task 縮排，`XX-NNa`、`XX-NNb`…
- 前綴沿用**同一節**既有前綴（SU／DA／UI／DC）；新的一節 → 提一個兩字母前綴，在步驟 3 計畫裡給使用者確認。
- 號碼取該前綴最大號＋1；**用過的號碼不重用**。
- 補完用 `git diff TODO.md` 秀給使用者看。

---

## 步驟 2 — 選任務

- 使用者有指定代號 → 做那一項。
- 沒指定 → 取第一個 `- [ ]` 的主 task；有子 task 時從第一個未完成的子 task 做起。
- 跳過標「要你決定」但使用者還沒決定的項目，或在計畫中先把決定點問清楚。
- 任務帶圖片（`![](assets/xxx.png)`）→ **用 Read 工具打開每張圖看**，圖通常就是規格。
- 任務跟講義有關 → 先讀 `doc/reference/指標清單.md` 與 `doc/reference/` 下的講義摘要；需要原文再看 `Docs/Ref/` PDF 的對應頁（`[K n]`）。

---

## 步驟 3 — 寫計畫，等使用者點頭（強制關卡）

程式檔變大後**不要整份讀進主 session**。派 `Explore` subagent（thoroughness "medium"）去找：相關區塊／函式的行號、資料格式（`data/indicators.json`、`data/series/`）、會連動的地方（頁尾、圖表設定、抓資料腳本）。只拿回結論和行號。

用這個格式回報：

```
▶ 準備動工：<代號> <標題>

【目標】<一句話：做完後網頁／資料會多了／變成什麼>

【動作】
  1. <動詞開頭，具體到哪個檔、哪個區塊／函式>
  2. ...
  （≤5 步；超過表示太大，先拆成子 task）

【會動到】<檔案清單>
【不會動】<明確劃界>

【要你決定的點】<條列，最多 2 個選項＋我的建議；或「無」>

【驗證方式】<做完怎麼證明它對了>

【版號】<預計 MINOR 或 PATCH，例：0.1.0 → 0.2.0>

【派工】worker：<worker-haiku／worker-sonnet／worker-opus>，理由 <一句>；verifier：verifier-sonnet
```

**使用者沒回應前不改任何檔。** 點頭後，把 TODO.md 該項改成 `[~]`。

---

## 步驟 4 — 派 worker subagent 執行

用 Agent tool，`subagent_type` 依下表選（`.claude/agents/`，frontmatter 已固定模型，**不另傳 `model`**）：

| 任務性質 | `subagent_type` | 例子 |
|---|---|---|
| 機械性小改：改文字、顏色、門檻值、加一個指標到既有清單 | `worker-haiku` | 改卡片標題、加一個 FRED 序列 |
| 一般功能：新 UI 區塊、新圖表、新抓資料來源，規格清楚 | `worker-sonnet` | 指標詳細圖、行事曆 |
| 動到資料結構／多處連動／規格要推敲 | `worker-opus` | 指標目錄格式、抓資料腳本＋畫面同時改 |

拿不準就往重的選一級。prompt 至少交代：

- 任務代號、TODO.md 原文、附圖路徑
- 使用者**已同意的計畫全文**，照計畫做，不加料
- Explore 找到的行號；寫法跟著現有檔案風格
- 外部腳本／CDN 一律鎖確切版號；抓資料失敗要有明確錯誤訊息，不可寫入空檔覆蓋舊資料
- 資料格式改動要相容舊資料
- **禁止**：commit、改 `TODO.md`、`VERSION`、`CHANGELOG.md`、頁尾版號與日期
- 計畫行不通 → 停下回報「哪裡不一樣、有哪些選項」
- 回報：改了哪些檔、哪幾段、為什麼

worker 回來後，主 session 用 `git diff --stat` 檢查範圍有沒有超出計畫；超出 → 回報使用者。

---

## 步驟 5 — 派 verifier subagent 驗證

**改的人不驗自己。** 主 session 另派 `subagent_type: verifier-sonnet`（不能改檔），交代：任務代號、【驗證方式】、worker 的改動清單、下列檢查；只回報 PASS／FAIL 和證據。

1. **JS 語法**（`index.html` 內嵌 script 與 `tools/*.mjs`）：

   ```bash
   T="${CLAUDE_JOB_DIR:-/tmp}/tmp"; mkdir -p "$T"
   python3 - "$T" <<'EOF'
   import re, pathlib, sys
   p = pathlib.Path("index.html")
   if p.exists():
       js = "\n;\n".join(re.findall(r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", p.read_text(encoding="utf-8"), re.S))
       pathlib.Path(sys.argv[1], "_check.js").write_text(js, encoding="utf-8")
   EOF
   [ -f "$T/_check.js" ] && node --check "$T/_check.js" && echo "index.html JS OK"
   for f in tools/*.mjs; do [ -f "$f" ] && node --check "$f" && echo "$f OK"; done
   ```

2. **資料檔**：`data/**/*.json` 全部能 parse；`data/indicators.json` 引用的序列在 `data/series/` 都有檔。

   ```bash
   node -e 'const fs=require("fs"),p=require("path");const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(p.join(d,e.name)):[p.join(d,e.name)]);if(fs.existsSync("data"))for(const f of walk("data").filter(f=>f.endsWith(".json")))JSON.parse(fs.readFileSync(f,"utf8"));console.log("JSON OK")'
   ```

3. **截圖**：本機開 HTTP server（`fetch` 讀 JSON 在 `file://` 會被擋），headless Chrome 截圖後用 Read 看圖。

   ```bash
   python3 -m http.server 8765 --bind 127.0.0.1 >/dev/null 2>&1 & SV=$!; sleep 1
   google-chrome --headless=new --disable-gpu --no-sandbox --virtual-time-budget=8000 \
     --window-size=1400,1000 --screenshot="$T/after.png" "http://127.0.0.1:8765/index.html"
   kill $SV
   ```
   要互動才看得到的功能 → 列出步驟請使用者本機手點。

verifier 回報後，主 session 自己 Read 截圖確認。**FAIL → 不收尾**，回報使用者、問要不要再派 worker 修。

---

## 步驟 6 — 收尾

呼叫 `task-release` skill。

---

## 步驟 7 — 回報

- 做完哪一項、版號、commit hash、分支名
- 驗證了什麼、結果如何
- TODO.md 下一個未完成項目
- `dev` 合併 commit（task-release 已合併進 `dev`）
- 提醒：要上線（`dev` → `main`）請說「release」

然後**停下來**，下一項由使用者決定。

---

## 版本紀錄

| 版號 | 日期 | 變更 |
|---|---|---|
| 1.1.0 | 2026-10-18 | SU-04 改成 dev 分支流程：worktree 從 `dev` 開出、收尾合併進 `dev`、release 才動 `main` |
| 1.0.0 | 2026-10-18 | 建立：沿用 strategy-matrix `task-next` 1.2.0，改成 Dashboard 專案（資料檔檢查、HTTP server 截圖、版號欄） |
