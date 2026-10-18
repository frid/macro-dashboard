#!/usr/bin/env node
// 抓 FRED 公開 CSV → data/series/<ID>.json（DA-02）
// 用法：
//   node tools/fetch-data.mjs                 抓 indicators.json 內所有 FRED 序列＋USREC
//   node tools/fetch-data.mjs DGS10 USREC     只抓指定序列
// Node 24 內建 fetch，零套件。失敗的序列不會建立或覆蓋檔案，結束碼為 1。

import { readFile, writeFile, rename, mkdir, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG = path.join(ROOT, 'data', 'indicators.json');
const OUT_DIR = path.join(ROOT, 'data', 'series');
const START_DATE = '1970-01-01';
const MAX_ATTEMPTS = 3;
const DELAY_MS = 400; // 序列之間的間隔，避免被限流

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- 從目錄收集序列 ----
// title 規則：優先用 role === 'main' 的引用，標題為「中文名 英文名」；
// 若序列只被 compare／component 引用，標題在後面加上 note（沒有 note 就不加）。
function collectSeries(catalog) {
  const map = new Map(); // id -> { id, title, substitute, isMain }
  for (const ind of catalog.indicators) {
    for (const s of ind.series ?? []) {
      if (s.source !== 'FRED') continue;
      const isMain = s.role === 'main';
      const base = `${ind.name_zh} ${ind.name_en}`;
      const title = isMain || !s.note ? base : `${base}（${s.note}）`;
      const prev = map.get(s.id);
      if (!prev) {
        map.set(s.id, { id: s.id, title, substitute: !!s.substitute, isMain });
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
  if (rec) map.set(rec, { id: rec, title: 'NBER 衰退期', substitute: false, isMain: true });
  return map;
}

// ---- 下載（含重試）----
async function download(id) {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(id)}&cosd=${START_DATE}`;
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { text: await res.text(), lastModified: res.headers.get('last-modified') };
    } catch (e) {
      lastErr = e;
      if (attempt < MAX_ATTEMPTS) await sleep(1000 * 2 ** (attempt - 1));
    }
  }
  throw new Error(`下載失敗（重試 ${MAX_ATTEMPTS} 次）：${lastErr.message}`);
}

// ---- 解析 CSV ----
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
  const ids = args.length ? [...new Set(args)] : [...all.keys()];
  const fetchedAt = new Date().toISOString().slice(0, 10);
  await mkdir(OUT_DIR, { recursive: true });

  const ok = [];
  const failed = [];
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    if (i > 0) await sleep(DELAY_MS);
    try {
      const meta = all.get(id) ?? { title: id, substitute: false };
      const { text, lastModified } = await download(id);
      const observations = parseCsv(id, text);
      const out = {
        id,
        title: meta.title,
        source: 'FRED',
        frequency: inferFrequency(observations),
        units: null,
        substitute: meta.substitute,
        last_updated: toDate(lastModified),
        fetched_at: fetchedAt,
        observations,
      };
      const content = serialize(out);
      JSON.parse(content); // 寫檔前自我檢查
      await writeAtomic(path.join(OUT_DIR, `${id}.json`), content);
      ok.push(id);
      console.log(`OK   ${id}（${observations.length} 筆）`);
    } catch (e) {
      failed.push({ id, reason: e.message });
      console.error(`FAIL ${id}：${e.message}`);
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
