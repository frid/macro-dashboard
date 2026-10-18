#!/usr/bin/env node
// 抓各來源資料 → data/series/<ID>.json（DA-02 FRED；DA-04 加 Yahoo／EIA／TradingView；DA-10 加 Cboe／美國財政部）
// DA-11 加 FEDWATCH → data/fedwatch.json（Yahoo ZQ 期貨＋federalreserve.gov FOMC 日程，依 CME FedWatch 方法自算）
// 用法：
//   node tools/fetch-data.mjs                     抓 indicators.json 內所有序列＋USREC，再產生 data/fedwatch.json
//   node tools/fetch-data.mjs DGS10 TV_BDI        只抓指定序列
//   node tools/fetch-data.mjs FEDWATCH            只產生 data/fedwatch.json（DA-11，下次 FOMC 會議利率機率）
//   抓完後執行 node tools/derive-data.mjs 重算衍生序列（data/derived/，DA-05）
// 依 series[].source 分派：
//   FRED         公開 CSV（fredgraph.csv）
//   YAHOO        chart API JSON（yahooSymbol，日線）
//   EIA          官網歷史資料頁 HTML 表格（eiaSeries，週資料）
//   TRADINGVIEW  圖表 WebSocket（tvSymbol、tvInterval，非官方協定；整批一條連線，逾時 30 秒）
//   CBOE         官方歷史 CSV（cboeSymbol，日資料，取 CLOSE）
//   UST          FRED 原序列（fredBase）＋美國財政部每日利率 CSV（ustType、ustColumn）補上 FRED 還沒有的日期
// Node 24 內建 fetch／WebSocket，零套件。失敗的序列不會建立或覆蓋檔案，結束碼為 1。

import { readFile, writeFile, rename, mkdir, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG = path.join(ROOT, 'data', 'indicators.json');
const OUT_DIR = path.join(ROOT, 'data', 'series');
const START_DATE = '1970-01-01';
const MAX_ATTEMPTS = 3;
const DELAY_MS = 400; // 序列之間的間隔，避免被限流
const TV_TIMEOUT_MS = 30000;
// Yahoo／EIA 擋沒有 User-Agent 的請求，送一般瀏覽器字串
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- 從目錄收集序列 ----
// title 規則：優先用 role === 'main' 的引用，標題為「中文名 英文名」；
// 若序列只被 compare／component 引用，標題在後面加上 note（沒有 note 就不加）。
function collectSeries(catalog) {
  const map = new Map(); // id -> { id, source, title, substitute, isMain, yahooSymbol?, eiaSeries?, tvSymbol?, tvInterval?, cboeSymbol?, ustType?, ustColumn?, fredBase? }
  for (const ind of catalog.indicators) {
    for (const s of ind.series ?? []) {
      const isMain = s.role === 'main';
      const base = `${ind.name_zh} ${ind.name_en}`;
      const title = isMain || !s.note ? base : `${base}（${s.note}）`;
      const prev = map.get(s.id);
      if (!prev) {
        map.set(s.id, {
          id: s.id,
          source: s.source,
          title,
          substitute: !!s.substitute,
          isMain,
          yahooSymbol: s.yahooSymbol,
          eiaSeries: s.eiaSeries,
          tvSymbol: s.tvSymbol,
          tvInterval: s.tvInterval,
          cboeSymbol: s.cboeSymbol,
          ustType: s.ustType,
          ustColumn: s.ustColumn,
          fredBase: s.fredBase,
        });
      } else {
        prev.substitute = prev.substitute || !!s.substitute;
        if (isMain && !prev.isMain) {
          prev.title = title;
          prev.isMain = true;
        }
      }
    }
  }
  const rec = catalog.recession?.series;
  if (rec) map.set(rec, { id: rec, source: 'FRED', title: 'NBER 衰退期', substitute: false, isMain: true });
  return map;
}

// ---- 下載（含重試）----
async function download(url, headers = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { text: await res.text(), lastModified: res.headers.get('last-modified') };
    } catch (e) {
      lastErr = e;
      if (attempt < MAX_ATTEMPTS) await sleep(1000 * 2 ** (attempt - 1));
    }
  }
  throw new Error(`下載失敗（重試 ${MAX_ATTEMPTS} 次）：${lastErr.message}`);
}

// 共用：只保留 START_DATE 起、依日期排序、同日去重（後者覆蓋）
function finalize(obs) {
  const m = new Map();
  for (const [d, v] of obs) if (d >= START_DATE) m.set(d, v);
  const out = [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  if (out.length === 0) throw new Error(`沒有 ${START_DATE} 之後的觀測值`);
  return out;
}

// Yahoo 數值為 float32（約 7 位有效數字），取 7 位有效數字去掉浮點雜訊
const toFloat32Precision = (x) => Number(x.toPrecision(7));

// ---- FRED：公開 CSV ----
function parseCsv(id, text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length === 0) throw new Error('回應為空');
  const header = lines[0].trim();
  if (header !== `observation_date,${id}`) {
    throw new Error(`CSV 表頭不符，預期 "observation_date,${id}"，實際 "${header.slice(0, 80)}"`);
  }
  const obs = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length !== 2) throw new Error(`第 ${i + 1} 行格式錯誤：${lines[i].slice(0, 80)}`);
    const date = parts[0].trim();
    const raw = parts[1].trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`第 ${i + 1} 行日期格式錯誤：${date}`);
    if (date < START_DATE) continue; // 以防 cosd 參數被忽略
    let value;
    if (raw === '' || raw === '.') value = null;
    else {
      value = Number(raw);
      if (!Number.isFinite(value)) throw new Error(`第 ${i + 1} 行數值無法解析：${raw}`);
    }
    obs.push([date, value]);
  }
  if (obs.length === 0) throw new Error(`沒有 ${START_DATE} 之後的觀測值`);
  return obs;
}

async function fetchFred(meta) {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(meta.id)}&cosd=${START_DATE}`;
  const { text, lastModified } = await download(url);
  return { observations: parseCsv(meta.id, text), lastUpdated: toDate(lastModified) };
}

// ---- YAHOO：chart API（日線）----
// 不用 range=max（會降採樣成月／週線），改用 period1=0～現在＋interval=1d 取完整日線。
// 日期以交易所時區換算；收盤為 null 的列（非交易日）略過；當日盤中未收盤的那一根也略過。
function localDate(sec, timeZone) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(sec * 1000));
}

async function fetchYahoo(meta) {
  const sym = meta.yahooSymbol;
  if (!sym) throw new Error('目錄缺 yahooSymbol');
  const now = Math.floor(Date.now() / 1000);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?period1=0&period2=${now}&interval=1d&includePrePost=false`;
  const { text } = await download(url, { 'User-Agent': UA });
  let j;
  try {
    j = JSON.parse(text);
  } catch {
    throw new Error(`Yahoo 回應不是 JSON：${text.slice(0, 80)}`);
  }
  const r = j?.chart?.result?.[0];
  if (!r) throw new Error(`Yahoo 無資料：${JSON.stringify(j?.chart?.error ?? j).slice(0, 120)}`);
  const m = r.meta ?? {};
  if (m.dataGranularity && m.dataGranularity !== '1d') throw new Error(`Yahoo 回傳頻率為 ${m.dataGranularity}，不是日線`);
  const tz = m.exchangeTimezoneName || 'America/New_York';
  const t = r.timestamp ?? [];
  const close = r.indicators?.quote?.[0]?.close ?? [];
  if (t.length === 0 || t.length !== close.length) throw new Error('Yahoo 時間與收盤筆數不符或為空');
  const reg = m.currentTradingPeriod?.regular;
  const openSession = reg && now < reg.end ? reg.start : Infinity;
  const obs = [];
  for (let i = 0; i < t.length; i++) {
    const c = close[i];
    if (c == null || !Number.isFinite(c)) continue;
    if (t[i] >= openSession) continue; // 盤中，尚未收盤
    obs.push([localDate(t[i], tz), toFloat32Precision(c)]);
  }
  const lastUpdated = m.regularMarketTime ? localDate(m.regularMarketTime, tz) : null;
  return { observations: finalize(obs), lastUpdated };
}

// ---- EIA：歷史資料頁 HTML 表格（週資料）----
// 每列 = 一個「年-月」（class B6），後接最多 5 組「週結束日 MM/DD（B5）＋數值（B3）」。
const MONTHS = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
const cellText = (s) => s.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();

function parseEia(html) {
  const obs = [];
  const rows = html.match(/<tr[\s>][\s\S]*?<\/tr>/gi) ?? [];
  for (const row of rows) {
    const ym = row.match(/class='B6'>([\s\S]*?)<\/td>/);
    if (!ym) continue;
    const label = cellText(ym[1]);
    const mm = label.match(/^(\d{4})-([A-Z][a-z]{2})$/);
    if (!mm || !MONTHS[mm[2]]) throw new Error(`EIA 年月欄格式錯誤：${label}`);
    const year = Number(mm[1]);
    const rowMonth = MONTHS[mm[2]];
    const cells = [...row.matchAll(/class='(B5|B3)'>([\s\S]*?)<\/td>/g)].map((x) => [x[1], cellText(x[2])]);
    for (let i = 0; i + 1 < cells.length; i += 2) {
      const [k1, d] = cells[i];
      const [k2, v] = cells[i + 1];
      if (k1 !== 'B5' || k2 !== 'B3') throw new Error(`EIA ${label} 欄位順序不符`);
      if (d === '') continue;
      const dm = d.match(/^(\d{2})\/(\d{2})$/);
      if (!dm) throw new Error(`EIA ${label} 日期格式錯誤：${d}`);
      const mon = Number(dm[1]);
      let y = year; // 跨年防呆（列為 12 月、日期為 1 月，或反之）
      if (rowMonth === 12 && mon === 1) y++;
      else if (rowMonth === 1 && mon === 12) y--;
      const date = `${y}-${dm[1]}-${dm[2]}`;
      const raw = v.replace(/,/g, '');
      let value;
      if (raw === '' || raw === '-' || raw === '--' || raw === 'NA' || raw === 'W') value = null;
      else {
        value = Number(raw);
        if (!Number.isFinite(value)) throw new Error(`EIA ${date} 數值無法解析：${v}`);
      }
      obs.push([date, value]);
    }
  }
  if (obs.length === 0) throw new Error('EIA 頁面找不到資料表');
  return obs;
}

async function fetchEia(meta) {
  const s = meta.eiaSeries;
  if (!s) throw new Error('目錄缺 eiaSeries');
  const url = `https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=${encodeURIComponent(s)}&f=W`;
  const { text } = await download(url, { 'User-Agent': UA });
  const rel = text.match(/>\s*Release Date:\s*(\d{2})\/(\d{2})\/(\d{4})\s*</);
  const lastUpdated = rel ? `${rel[3]}-${rel[1]}-${rel[2]}` : null;
  return { observations: finalize(parseEia(text)), lastUpdated };
}

// ---- CBOE／UST 共用：依表頭名稱取欄位的簡易 CSV（兩者欄位都不含逗號）----
// 日期為 MM/DD/YYYY，轉成 YYYY-MM-DD；空值略過（不記 null，日資料缺的日子本來就不列）。
function parseNamedCsv(label, text, column) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length < 2) throw new Error(`${label} 回應沒有資料列：${text.slice(0, 80)}`);
  const head = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const di = head.findIndex((h) => h.toUpperCase() === 'DATE');
  const vi = head.indexOf(column);
  if (di < 0 || vi < 0) throw new Error(`${label} 表頭找不到 DATE 或 "${column}"，實際 "${lines[0].slice(0, 120)}"`);
  const obs = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',').map((x) => x.trim().replace(/^"|"$/g, ''));
    const dm = (c[di] ?? '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!dm) throw new Error(`${label} 第 ${i + 1} 行日期格式錯誤：${lines[i].slice(0, 80)}`);
    const raw = c[vi] ?? '';
    if (raw === '' || raw === 'N/A') continue;
    const value = Number(raw);
    if (!Number.isFinite(value)) throw new Error(`${label} 第 ${i + 1} 行數值無法解析：${raw}`);
    obs.push([`${dm[3]}-${dm[1]}-${dm[2]}`, value]);
  }
  if (obs.length === 0) throw new Error(`${label} 欄 "${column}" 沒有數值`);
  return obs;
}

// ---- CBOE：官方歷史 CSV（cdn.cboe.com 會 307 轉址到 cdn-api.cboe.com，fetch 預設跟隨）----
// 欄位 DATE,OPEN,HIGH,LOW,CLOSE；取 CLOSE。last_updated 用 HTTP last-modified，沒有則用最後一筆觀測日。
async function fetchCboe(meta) {
  const sym = meta.cboeSymbol;
  if (!sym) throw new Error('目錄缺 cboeSymbol');
  const url = `https://cdn.cboe.com/api/global/us_indices/daily_prices/${encodeURIComponent(sym)}_History.csv`;
  const { text, lastModified } = await download(url, { 'User-Agent': UA });
  const observations = finalize(parseNamedCsv(`Cboe ${sym}`, text, 'CLOSE'));
  return { observations, lastUpdated: toDate(lastModified) ?? observations.at(-1)[0] };
}

// ---- UST：FRED 原序列＋美國財政部每日利率 CSV ----
// FRED 日資料約落後 1 個營業日；財政部當天傍晚就有。做法：先抓 FRED（fredBase）完整歷史，
// 再抓財政部「FRED 最後一個有值日期」所在年起到今年的 CSV（1 月時自然含前一年），
// 只把晚於 FRED 最後有值日的日期接上去；同一天兩邊都有值時以 FRED 為準。
// 財政部抓不到或解析失敗 → 整個序列失敗（不寫檔、不覆寫舊檔）。
// last_updated 用最後一筆有值的觀測日（財政部 CSV 沒有發布日期）。
async function fetchUst(meta) {
  const { fredBase, ustType, ustColumn } = meta;
  if (!fredBase || !ustType || !ustColumn) throw new Error('目錄缺 fredBase、ustType 或 ustColumn');
  const fred = (await fetchFred({ id: fredBase })).observations;
  const fredLast = fred.filter(([, v]) => v != null).at(-1)?.[0];
  if (!fredLast) throw new Error(`FRED ${fredBase} 沒有有效數值`);
  const thisYear = new Date().getUTCFullYear();
  const ust = [];
  for (let y = Number(fredLast.slice(0, 4)); y <= thisYear; y++) {
    await sleep(DELAY_MS);
    const url = `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${y}/all?type=${encodeURIComponent(ustType)}&field_tdr_date_value=${y}&page&_format=csv`;
    const { text } = await download(url, { 'User-Agent': UA });
    ust.push(...parseNamedCsv(`美國財政部 ${ustType} ${y}`, text, ustColumn));
  }
  const m = new Map(fred);
  for (const [d, v] of ust) if (d > fredLast) m.set(d, v);
  const observations = finalize([...m.entries()]);
  return { observations, lastUpdated: observations.filter(([, v]) => v != null).at(-1)[0] };
}

// ---- TRADINGVIEW：圖表 WebSocket（非官方協定）----
// 封包格式 ~m~<長度>~m~<JSON>；收到 ~h~ 心跳要原樣回送。整批序列共用一條連線，每個序列一個 chart session。
// 日期：月線取年月、日固定 01；日線若時間戳記在 UTC 12:00 之後（交易時段從前一晚開始，如外匯／金屬現貨），
// 日期 +1 天，否則取 UTC 日期（如 INDEX:BDI 為 00:00 UTC，本來就是當日）。
// 抓不到 last_updated，記 null。
function tvDate(sec, interval) {
  const d = new Date(sec * 1000);
  if (/M$/.test(interval)) return `${d.toISOString().slice(0, 7)}-01`;
  if (d.getUTCHours() >= 12) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function fetchTradingView(metas) {
  return new Promise((resolve) => {
    const results = new Map(); // id -> { observations } | { error }
    const bars = metas.map(() => new Map()); // 時間戳記 -> 收盤
    const done = metas.map(() => false);
    let finished = false;
    let ws;
    const finish = (globalErr) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      try {
        ws?.close();
      } catch {}
      metas.forEach((m, i) => {
        if (results.has(m.id)) return;
        if (!done[i]) results.set(m.id, { error: globalErr ?? 'TradingView 未完成' });
      });
      resolve(results);
    };
    const timer = setTimeout(() => finish(`TradingView 逾時（${TV_TIMEOUT_MS / 1000} 秒）`), TV_TIMEOUT_MS);
    const settle = (i, err) => {
      if (done[i]) return;
      done[i] = true;
      const m = metas[i];
      if (err) results.set(m.id, { error: err });
      else {
        try {
          const obs = [...bars[i].entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([t, c]) => [tvDate(t, m.tvInterval), c]);
          results.set(m.id, { observations: finalize(obs) });
        } catch (e) {
          results.set(m.id, { error: e.message });
        }
      }
      if (done.every(Boolean)) finish();
    };

    for (const [i, m] of metas.entries()) {
      if (!m.tvSymbol || !m.tvInterval) settle(i, '目錄缺 tvSymbol 或 tvInterval');
    }
    if (finished) return;

    try {
      ws = new WebSocket('wss://data.tradingview.com/socket.io/websocket?type=chart', {
        headers: { Origin: 'https://www.tradingview.com', 'User-Agent': UA },
      });
    } catch (e) {
      finish(`TradingView 連線失敗：${e.message}`);
      return;
    }
    const pack = (s) => `~m~${s.length}~m~${s}`;
    const send = (m, p) => ws.send(pack(JSON.stringify({ m, p })));
    let started = false;

    ws.onerror = (e) => finish(`TradingView 連線錯誤：${e?.message ?? e?.error?.message ?? 'unknown'}`);
    ws.onclose = () => finish('TradingView 連線中斷');
    ws.onmessage = (e) => {
      for (const raw of String(e.data).split(/~m~\d+~m~/).filter(Boolean)) {
        if (raw.startsWith('~h~')) {
          ws.send(pack(raw)); // 心跳原樣回送
          continue;
        }
        let j;
        try {
          j = JSON.parse(raw);
        } catch {
          continue;
        }
        if (!started && j.session_id) {
          started = true;
          send('set_auth_token', ['unauthorized_user_token']);
          metas.forEach((m, i) => {
            if (done[i]) return;
            const cs = `cs_${i}`;
            send('chart_create_session', [cs, '']);
            send('resolve_symbol', [cs, 'sym', '=' + JSON.stringify({ symbol: m.tvSymbol })]);
            send('create_series', [cs, 's1', 's1', 'sym', m.tvInterval, 20000, '']);
          });
          continue;
        }
        if (j.m === 'critical_error' || j.m === 'protocol_error') {
          finish(`TradingView ${j.m}：${JSON.stringify(j.p).slice(0, 120)}`);
          return;
        }
        const cs = j.p?.[0];
        if (typeof cs !== 'string' || !cs.startsWith('cs_')) continue;
        const i = Number(cs.slice(3));
        if (!(i >= 0 && i < metas.length)) continue;
        if (j.m === 'symbol_error') settle(i, `TradingView 代碼無效：${metas[i].tvSymbol}（${JSON.stringify(j.p.slice(1)).slice(0, 80)}）`);
        else if (j.m === 'series_error') settle(i, `TradingView 序列錯誤：${JSON.stringify(j.p.slice(1)).slice(0, 80)}`);
        else if (j.m === 'timescale_update' || j.m === 'du') {
          const b = j.p[1]?.s1?.s;
          if (Array.isArray(b)) {
            for (const x of b) {
              const [t, , , , c] = x.v ?? [];
              if (Number.isFinite(t) && Number.isFinite(c)) bars[i].set(t, c);
            }
          }
        } else if (j.m === 'series_completed') {
          settle(i, bars[i].size === 0 ? 'TradingView 回傳 0 筆' : null);
        }
      }
    };
  });
}

// ---- FEDWATCH：下次 FOMC 會議利率機率（DA-11）----
// 依 CME FedWatch 公開方法論，用 Yahoo ZQ（30 天聯邦基金期貨）各月合約自算（替代；不抓 cmegroup.com）。
// 1. federalreserve.gov FOMC 日程頁：<h4>YYYY FOMC Meetings 區塊，取 fomc-meeting__month／__date；
//    兩天會議取第二天為決策日；跨月（如 "Apr/May" "30-1"）取後一個月；notation vote／unscheduled 等非例會略過。
// 2. 只算最近一場決策日 >= 今天（美東日期）的會議；決策日隔天生效。
// 3. 會議月 N 天、會前 m 天（= 決策日）：下個月沒有會議 → 下月合約隱含利率當會後利率 post，
//    反推會前 pre = (avg·N − post·(N−m))/m；否則前月沒有會議 → 前月當 pre，推 post = (avg·N − pre·m)/(N−m)。
//    隱含利率 = 100 − 價格。Δ = post − pre，以 25bp 步階拆成兩個相鄰目標區間的機率。
// 4. now 用最新一根日線收盤（盤中為最新價）；1d／1w／1m 以今天（美東）往前 1 天／7 天／1 個月，
//    取該日或之前最近、兩個合約都有收盤的交易日重算（同一場會議）。
// 目標區間取 data/series/DFEDTARL、DFEDTARU（各期取價格日或之前最近一筆）；全量執行時這兩個序列會先更新。
// 任一步失敗 → 丟出錯誤，不寫檔、不覆蓋舊的 data/fedwatch.json。
const FEDWATCH_OUT = path.join(ROOT, 'data', 'fedwatch.json');
const FOMC_URL = 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm';
const FEDWATCH_REF = 'https://www.cmegroup.com/cn-t/markets/interest-rates/cme-fedwatch-tool.html';
const ZQ_CODES = 'FGHJKMNQUVXZ'; // 1～12 月期貨月碼
const MONTH_NAMES = { January: 1, February: 2, March: 3, April: 4, May: 5, June: 6, July: 7, August: 8, September: 9, October: 10, November: 11, December: 12 };

const pad2 = (n) => String(n).padStart(2, '0');
const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const addMonth = (y, m, k) => {
  const t = y * 12 + (m - 1) + k;
  return [Math.floor(t / 12), (t % 12) + 1];
};
const ymKey = (y, m) => `${y}-${pad2(m)}`;
const etToday = () => localDate(Math.floor(Date.now() / 1000), 'America/New_York');

function shiftDate(iso, { days = 0, months = 0 }) {
  const [y, m, d] = iso.split('-').map(Number);
  if (months) {
    const [y2, m2] = addMonth(y, m, months);
    return `${y2}-${pad2(m2)}-${pad2(Math.min(d, daysInMonth(y2, m2)))}`;
  }
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// 合約月最後一個平日（未扣假日；ZQ 於合約月最後營業日到期）
function lastWeekday(y, m) {
  let d = daysInMonth(y, m);
  while ([0, 6].includes(new Date(Date.UTC(y, m - 1, d)).getUTCDay())) d--;
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function parseFomc(html) {
  const meetings = [];
  for (const b of html.split(/<h4[\s>]/i).slice(1)) {
    const ym = b.match(/^[\s\S]{0,200}?(\d{4}) FOMC Meetings/);
    if (!ym) continue;
    const year = Number(ym[1]);
    const items = [...b.matchAll(/class="[^"]*fomc-meeting__(month|date)\b[^"]*"[^>]*>([\s\S]*?)<\/div>/g)];
    for (let i = 0; i + 1 < items.length; i++) {
      if (items[i][1] !== 'month' || items[i + 1][1] !== 'date') continue;
      const monthTxt = cellText(items[i][2]);
      const dateTxt = cellText(items[i + 1][2]);
      i++;
      const dm = dateTxt.match(/^(\d{1,2})(?:-(\d{1,2}))?\*?$/);
      if (!dm) continue; // notation vote、unscheduled、cancelled 等非例會
      const lastMonth = monthTxt.split('/').at(-1).trim();
      const mon = MONTH_NAMES[lastMonth] ?? MONTHS[lastMonth.slice(0, 3)];
      if (!mon) throw new Error(`FOMC 日程月份無法解析：${year} ${monthTxt}`);
      const day = Number(dm[2] ?? dm[1]);
      if (day < 1 || day > daysInMonth(year, mon)) throw new Error(`FOMC 日程日期不合理：${year} ${monthTxt} ${dateTxt}`);
      meetings.push(`${year}-${pad2(mon)}-${pad2(day)}`);
    }
  }
  if (meetings.length === 0) throw new Error('FOMC 日程頁找不到任何會議（頁面結構可能改變）');
  return [...new Set(meetings)].sort();
}

// Yahoo ZQ 月合約日線：Map<YYYY-MM-DD, 收盤>（含當日盤中最新價，作為 now）
async function fetchZq(contract) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${contract}.CBT?range=3mo&interval=1d`;
  const { text } = await download(url, { 'User-Agent': UA }).catch((e) => {
    throw new Error(`Yahoo ${contract}.CBT ${e.message}`);
  });
  let j;
  try {
    j = JSON.parse(text);
  } catch {
    throw new Error(`Yahoo ${contract} 回應不是 JSON：${text.slice(0, 80)}`);
  }
  const r = j?.chart?.result?.[0];
  if (!r) throw new Error(`Yahoo ${contract} 無資料：${JSON.stringify(j?.chart?.error ?? j).slice(0, 120)}`);
  const tz = r.meta?.exchangeTimezoneName || 'America/New_York';
  const t = r.timestamp ?? [];
  const close = r.indicators?.quote?.[0]?.close ?? [];
  if (t.length === 0 || t.length !== close.length) throw new Error(`Yahoo ${contract} 時間與收盤筆數不符或為空`);
  const m = new Map();
  for (let i = 0; i < t.length; i++) {
    const c = close[i];
    if (c == null || !Number.isFinite(c)) continue;
    m.set(localDate(t[i], tz), toFloat32Precision(c));
  }
  if (m.size === 0) throw new Error(`Yahoo ${contract} 沒有收盤價`);
  return m;
}

async function readTarget(id) {
  const j = JSON.parse(await readFile(path.join(OUT_DIR, `${id}.json`), 'utf8'));
  const obs = (j.observations ?? []).filter(([, v]) => v != null);
  if (obs.length === 0) throw new Error(`data/series/${id}.json 沒有數值`);
  return obs;
}
const valueAsOf = (obs, date) => {
  let v = null;
  for (const [d, x] of obs) {
    if (d > date) break;
    v = x;
  }
  return v;
};

// 依 Δ（百分點）拆成相鄰兩個 25bp 目標區間的機率
function rangeProbs(lowerBps, delta) {
  const steps = delta / 0.25;
  const k = Math.floor(steps + 1e-9);
  const frac = Math.max(0, steps - k);
  const out = [];
  for (const [shift, p] of [[k, 1 - frac], [k + 1, frac]]) {
    const lo = lowerBps + 25 * shift;
    if (p > 1e-6) out.push({ range: `${lo}-${lo + 25}`, p: Number(p.toFixed(4)), shift, lo });
  }
  if (out.length === 0) throw new Error('機率計算結果為空');
  if (out[0].lo < 0) throw new Error(`目標區間跌破 0（Δ=${delta}）`);
  const summary = { ease: 0, no_change: 0, hike: 0 };
  for (const o of out) summary[o.shift < 0 ? 'ease' : o.shift > 0 ? 'hike' : 'no_change'] += o.p;
  for (const key of Object.keys(summary)) summary[key] = Number(summary[key].toFixed(4));
  return { probabilities: out.map(({ range, p }) => ({ range, p })), summary };
}

async function fetchFedWatch() {
  const today = etToday();
  const { text: html } = await download(FOMC_URL, { 'User-Agent': UA }).catch((e) => {
    throw new Error(`FOMC 日程頁 ${e.message}`);
  });
  const meetings = parseFomc(html);
  const meeting = meetings.find((d) => d >= today);
  if (!meeting) throw new Error(`FOMC 日程沒有 ${today} 之後的會議`);
  const meetingMonths = new Set(meetings.map((d) => d.slice(0, 7)));
  const [y, mo, dd] = meeting.split('-').map(Number);
  const N = daysInMonth(y, mo);
  const m = dd; // 決策日隔天生效 → 會前（舊利率）天數 = 決策日
  const [ny, nm] = addMonth(y, mo, 1);
  const [py, pm] = addMonth(y, mo, -1);
  if (ny > Number(meetings.at(-1).slice(0, 4))) throw new Error(`FOMC 日程尚未列出 ${ny} 年會議，無法判斷下個月是否有會議`);
  let method;
  if (!meetingMonths.has(ymKey(ny, nm))) method = 'next_month';
  else if (!meetingMonths.has(ymKey(py, pm)) && m < N) method = 'prev_month';
  else throw new Error(`會議 ${meeting} 前後月份都有會議（或月底決策且下月有會議），單次會議算法不適用`);

  const code = (yy, mm) => `ZQ${ZQ_CODES[mm - 1]}${String(yy).slice(-2)}`;
  const mainC = code(y, mo);
  const otherC = method === 'next_month' ? code(ny, nm) : code(py, pm);
  const mainP = await fetchZq(mainC);
  await sleep(DELAY_MS);
  const otherP = await fetchZq(otherC);

  const lower = await readTarget('DFEDTARL');
  const upper = await readTarget('DFEDTARU');
  // 目標區間資料不得早於上一場已生效的會議（避免用到會前的舊區間）
  const prevMeeting = meetings.filter((d) => d < today).at(-1);
  if (prevMeeting) {
    const eff = shiftDate(prevMeeting, { days: 1 });
    const lastL = lower.at(-1)[0];
    if (lastL < eff && eff <= today) throw new Error(`DFEDTARL 最新 ${lastL} 早於上次會議生效日 ${eff}，請先更新 DFEDTARL／DFEDTARU`);
  }

  const common = [...mainP.keys()].filter((d) => otherP.has(d)).sort();
  if (common.length === 0) throw new Error(`${mainC}／${otherC} 沒有共同交易日`);
  const pickDate = (target) => {
    const d = common.filter((x) => x <= target).at(-1);
    if (!d) throw new Error(`${target} 之前沒有 ${mainC}／${otherC} 共同交易日（Yahoo range=3mo 不足）`);
    return d;
  };
  const horizons = {
    now: common.at(-1),
    '1d': pickDate(shiftDate(today, { days: -1 })),
    '1w': pickDate(shiftDate(today, { days: -7 })),
    '1m': pickDate(shiftDate(today, { months: -1 })),
  };

  const r6 = (x) => Number(x.toFixed(6));
  const probabilities = {};
  const summary = {};
  const inputs = { method, contracts: [mainC, otherC], meeting_month_days: N, days_before_effective: m, horizons: {} };
  for (const [h, date] of Object.entries(horizons)) {
    const pMain = mainP.get(date);
    const pOther = otherP.get(date);
    const avg = 100 - pMain;
    const other = 100 - pOther;
    let pre;
    let post;
    if (method === 'next_month') {
      post = other;
      pre = (avg * N - post * (N - m)) / m;
    } else {
      pre = other;
      post = (avg * N - pre * m) / (N - m);
    }
    const delta = post - pre;
    const lo = valueAsOf(lower, date);
    const up = valueAsOf(upper, date);
    if (lo == null || up == null) throw new Error(`${date} 找不到目標區間（DFEDTARL／DFEDTARU）`);
    const target = { lower: Math.round(lo * 100), upper: Math.round(up * 100) };
    if (target.upper - target.lower !== 25) throw new Error(`${date} 目標區間不是 25bp 寬：${target.lower}-${target.upper}`);
    const r = rangeProbs(target.lower, delta);
    probabilities[h] = r.probabilities;
    summary[h] = r.summary;
    inputs.horizons[h] = {
      price_date: date,
      prices: { [mainC]: pMain, [otherC]: pOther },
      target,
      avg: r6(avg),
      pre: r6(pre),
      post: r6(post),
      delta: r6(delta),
    };
  }

  return {
    source: 'Yahoo Finance ZQ 期貨＋federalreserve.gov FOMC 日程，依 CME FedWatch 方法自算',
    substitute: true,
    reference_url: FEDWATCH_REF,
    generated_at: new Date().toISOString(),
    as_of: today,
    price_date: horizons.now,
    meeting: {
      date: meeting,
      effective: shiftDate(meeting, { days: 1 }),
      contract: mainC,
      expires: lastWeekday(y, mo),
      price: mainP.get(horizons.now),
    },
    current_target: inputs.horizons.now.target,
    probabilities,
    summary,
    inputs,
  };
}

async function saveFedWatch() {
  const out = await fetchFedWatch();
  const content = JSON.stringify(out, null, 2) + '\n';
  JSON.parse(content); // 寫檔前自我檢查
  await writeAtomic(FEDWATCH_OUT, content);
  const s = out.summary.now;
  console.log(`OK   FEDWATCH（${out.meeting.date} 會議，${out.meeting.contract} ${out.meeting.price}，價格日 ${out.price_date}；降 ${s.ease}／不變 ${s.no_change}／升 ${s.hike}）`);
}

// ---- 由日期間距推斷頻率（取間距中位數，天）----
function inferFrequency(obs) {
  if (obs.length < 2) return null;
  const t = obs.map(([d]) => Date.parse(d + 'T00:00:00Z'));
  const gaps = [];
  for (let i = 1; i < t.length; i++) gaps.push((t[i] - t[i - 1]) / 86400000);
  gaps.sort((a, b) => a - b);
  const med = gaps[Math.floor(gaps.length / 2)];
  if (med <= 4) return 'daily';
  if (med <= 10) return 'weekly';
  if (med <= 45) return 'monthly';
  if (med <= 135) return 'quarterly';
  return 'annual';
}

const toDate = (httpDate) => {
  if (!httpDate) return null;
  const t = Date.parse(httpDate);
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
};

// 每筆觀測值一行，方便看 git diff
function serialize(o) {
  const head = ['id', 'title', 'source', 'frequency', 'units', 'substitute', 'last_updated', 'fetched_at']
    .map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(o[k])}`)
    .join(',\n');
  const rows = o.observations.map((r) => `    ${JSON.stringify(r)}`).join(',\n');
  return `{\n${head},\n  "observations": [\n${rows}\n  ]\n}\n`;
}

async function writeAtomic(file, content) {
  const tmp = `${file}.tmp-${process.pid}`;
  try {
    await writeFile(tmp, content, 'utf8');
    await rename(tmp, file);
  } catch (e) {
    await unlink(tmp).catch(() => {});
    throw e;
  }
}

async function main() {
  const catalog = JSON.parse(await readFile(CATALOG, 'utf8'));
  const all = collectSeries(catalog);
  const args = process.argv.slice(2);
  // FEDWATCH 不是序列，是 data/fedwatch.json；不帶參數時在所有序列之後一起產生
  const runFedWatch = args.length === 0 || args.includes('FEDWATCH');
  const ids = args.length ? [...new Set(args.filter((a) => a !== 'FEDWATCH'))] : [...all.keys()];
  const fetchedAt = new Date().toISOString().slice(0, 10);
  await mkdir(OUT_DIR, { recursive: true });

  const ok = [];
  const failed = [];

  const save = async (meta, observations, lastUpdated) => {
    const out = {
      id: meta.id,
      title: meta.title,
      source: meta.source,
      frequency: inferFrequency(observations),
      units: null,
      substitute: meta.substitute,
      last_updated: lastUpdated,
      fetched_at: fetchedAt,
      observations,
    };
    const content = serialize(out);
    JSON.parse(content); // 寫檔前自我檢查
    await writeAtomic(path.join(OUT_DIR, `${meta.id}.json`), content);
    ok.push(meta.id);
    const last = observations.at(-1);
    console.log(`OK   ${meta.id}（${meta.source}，${observations.length} 筆，最新 ${last[0]} = ${last[1]}）`);
  };
  const fail = (id, reason) => {
    failed.push({ id, reason });
    console.error(`FAIL ${id}：${reason}`);
  };

  const metas = ids.map((id) => all.get(id) ?? { id, source: 'FRED', title: id, substitute: false });
  const fetchers = { FRED: fetchFred, YAHOO: fetchYahoo, EIA: fetchEia, CBOE: fetchCboe, UST: fetchUst };

  // FRED／YAHOO／EIA／CBOE／UST：逐一抓
  let n = 0;
  for (const meta of metas) {
    if (meta.source === 'TRADINGVIEW') continue;
    if (n++ > 0) await sleep(DELAY_MS);
    try {
      const f = fetchers[meta.source];
      if (!f) throw new Error(`未知的來源：${meta.source}`);
      const { observations, lastUpdated } = await f(meta);
      await save(meta, observations, lastUpdated);
    } catch (e) {
      fail(meta.id, e.message);
    }
  }

  // TRADINGVIEW：整批一條連線；失敗不影響上面已寫入的序列
  const tv = metas.filter((m) => m.source === 'TRADINGVIEW');
  if (tv.length) {
    const results = await fetchTradingView(tv);
    for (const meta of tv) {
      const r = results.get(meta.id);
      try {
        if (!r || r.error) throw new Error(r?.error ?? 'TradingView 無結果');
        await save(meta, r.observations, null);
      } catch (e) {
        fail(meta.id, e.message);
      }
    }
  }

  // FEDWATCH：讀 data/series/DFEDTARL、DFEDTARU，所以放在序列之後；失敗不寫檔、不覆蓋舊檔
  if (runFedWatch) {
    try {
      await saveFedWatch();
      ok.push('FEDWATCH');
    } catch (e) {
      fail('FEDWATCH', e.message);
    }
  }

  console.log(`\n成功 ${ok.length}：${ok.join(' ')}`);
  if (failed.length) {
    console.log(`失敗 ${failed.length}：`);
    for (const f of failed) console.log(`  ${f.id}：${f.reason}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
