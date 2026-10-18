#!/usr/bin/env node
// 由 data/series/ 計算衍生序列 → data/derived/<ID>.json（DA-05）
// 用法（先抓資料再算衍生）：
//   node tools/fetch-data.mjs
//   node tools/derive-data.mjs                    計算全部衍生序列
//   node tools/derive-data.mjs DRV_SAHM DRV_CPI_YOY  只算指定的
// 衍生檔格式同 data/series/<ID>.json，source 固定 "DERIVED"，另加 inputs／formula／check（選填）。
// 只讀本機 data/series/，不連網。輸入檔缺少或算出 0 筆的衍生序列不會建立或覆蓋檔案，結束碼為 1。

import { readFile, writeFile, rename, mkdir, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IN_DIR = path.join(ROOT, 'data', 'series');
const OUT_DIR = path.join(ROOT, 'data', 'derived');

// ---- 小工具 ----
// 四捨五入到 n 位小數，順便去掉浮點雜訊（-0 轉成 0）
const round = (x, n) => {
  const v = Number(x.toFixed(n));
  return Object.is(v, -0) ? 0 : v;
};

// 'YYYY-MM-DD' 加減 k 個月（日固定沿用原日期；月資料一律為 01）
function addMonths(date, k) {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7)) - 1 + k;
  const yy = y + Math.floor(m / 12);
  const mm = ((m % 12) + 12) % 12;
  return `${String(yy).padStart(4, '0')}-${String(mm + 1).padStart(2, '0')}${date.slice(7)}`;
}

// 該月所屬季的季初日期（GDP 以季初日期標示）
const quarterStart = (date) => {
  const m = Number(date.slice(5, 7));
  const qm = m - ((m - 1) % 3);
  return `${date.slice(0, 4)}-${String(qm).padStart(2, '0')}-01`;
};

// 只取非 null 值的 Map：日期 -> 數值
const valueMap = (s) => new Map(s.observations.filter(([, v]) => v != null).map(([d, v]) => [d, v]));

// 誤差統計（|a − b|）
function diffStats(pairs, digits = 3) {
  if (pairs.length === 0) return { n: 0, max_abs_diff: null, mean_abs_diff: null };
  const d = pairs.map(([a, b]) => Math.abs(a - b));
  return {
    n: d.length,
    max_abs_diff: round(Math.max(...d), digits),
    mean_abs_diff: round(d.reduce((s, x) => s + x, 0) / d.length, digits),
  };
}

// ---- 共用算法 ----
// 月增減：本月 − 上個月（以日期對齊，上個月缺值則略過）
function momChange(s, digits) {
  const m = valueMap(s);
  const out = [];
  for (const [d, v] of m) {
    const p = m.get(addMonths(d, -1));
    if (p != null) out.push([d, round(v - p, digits)]);
  }
  return out;
}

// 年增率 %：本月 ÷ 12 個月前同月 − 1，×100（以日期對齊，不用索引）
function yoy(s, digits = 2) {
  const m = valueMap(s);
  const out = [];
  for (const [d, v] of m) {
    const p = m.get(addMonths(d, -12));
    if (p != null && p !== 0) out.push([d, round((v / p - 1) * 100, digits)]);
  }
  return out;
}

// ---- Sahm 規則（自算）----
// 3MA(t) = UNRATE 在 t、t−1、t−2 三個月的平均（三個月都要有值）。
// Sahm(t) = 3MA(t) − min{ 3MA(t−12) … 3MA(t−1) }（前 12 個月，不含當月）。
// 序列開頭：t−12 早於第一個 3MA 時（前 12 個月不完整）不計算；之後窗口內缺值的 3MA 略過（如 UNRATE 2025-10 缺值）。
// 窗口以三種候選（t−12～t−1／t−11～t／t−12～t）對照 SAHMREALTIME，t−12～t−1 平均誤差最小（DA-05 實測）。
function sahm(unrate) {
  const u = valueMap(unrate);
  const ma = new Map();
  for (const d of u.keys()) {
    const a = u.get(d), b = u.get(addMonths(d, -1)), c = u.get(addMonths(d, -2));
    if (a != null && b != null && c != null) ma.set(d, (a + b + c) / 3);
  }
  const firstMa = ma.keys().next().value;
  const out = [];
  for (const [d, v] of ma) {
    if (addMonths(d, -12) < firstMa) continue;
    const prior = [];
    for (let k = -12; k <= -1; k++) {
      const x = ma.get(addMonths(d, k));
      if (x != null) prior.push(x);
    }
    if (prior.length === 0) continue;
    out.push([d, round(v - Math.min(...prior), 2)]);
  }
  return out;
}

// 與 SAHMREALTIME 比對（日期相同且兩邊都有值）
const compare = (obs, ref) => {
  const r = valueMap(ref);
  return obs.filter(([d]) => r.has(d)).map(([d, v]) => [v, r.get(d)]);
};

// 存量 ÷ GDP ×100（百分比）：債務是存量、GDP 已是年率，不再年化。
// 單位：存量為百萬美元、GDP 為十億美元（季調年率，以季初日期標示）→ 存量 ÷ (GDP × 1000)。
// 對齊：存量日期所屬季的 GDP；該季 GDP 尚未公布則用最新一季 GDP（fallback 記錄日期，歷史中間缺值不補）。
// quarterEndOnly：月資料只取季末月（3／6／9／12 月）對該季 GDP（如 REVOLSL）。
function stockToGdp(stock, gdpSeries, { quarterEndOnly = false, digits = 2 } = {}) {
  const gdp = valueMap(gdpSeries);
  const lastGdp = gdpSeries.observations.filter(([, v]) => v != null).at(-1);
  const obs = [];
  const fallback = [];
  for (const [d, v] of valueMap(stock)) {
    if (quarterEndOnly && Number(d.slice(5, 7)) % 3 !== 0) continue;
    let g = gdp.get(quarterStart(d));
    if (g == null) {
      if (quarterStart(d) <= lastGdp[0]) continue;
      g = lastGdp[1];
      fallback.push(d);
    }
    obs.push([d, round((v / (g * 1000)) * 100, digits)]);
  }
  return { obs, gdp_fallback: fallback.length ? { gdp_date: lastGdp[0], from: fallback[0], to: fallback.at(-1) } : null };
}

// ---- 衍生序列定義 ----
// inputs：計算用的序列 id（寫進檔案，last_updated／substitute 由此決定）；
// checkInputs：只用於 check 比對的序列 id（不寫進 inputs；缺檔同樣視為失敗）；
// compute(s) 回傳 { observations, check? }
const yoyDef = (id, input, title) => ({
  id,
  title,
  units: '%',
  inputs: [input],
  formula: `${input} 年增率（%）＝ 本月 ÷ 12 個月前同月 − 1，×100；以日期對齊，前一年同月缺值則略過；取 2 位小數。`,
  compute: (s) => ({ observations: yoy(s[input]) }),
});

// G 區債務圖組（DA-07）：每種債務 3 個衍生序列 —— 年增率、占 GDP 比、占 GDP 比的年增率（講義「水準／YoY／占 GDP／占 GDP 的 YoY」四張一組 [K 69–91]）
// 單位：債務類序列皆為百萬美元，GDP 為十億美元。REVOLSL 為月資料，占 GDP 比只取季末月（3／6／9／12 月）。
const DEBTS = [
  { code: 'GFDEBTN', zh: '聯邦總債務', en: 'Federal Debt' },
  { code: 'HMLBSHNO', zh: '住宅房貸', en: 'Home Mortgages' },
  { code: 'MABSHNO', zh: '家庭持有房貸資產', en: 'Mortgage Assets Held by Households' },
  { code: 'CMLBSHNO', zh: '商業房貸', en: 'Commercial Mortgages' },
  { code: 'SLOASM', zh: '學生貸款', en: 'Student Loans' },
  { code: 'REVOLSL', zh: '循環信用', en: 'Revolving Consumer Credit', quarterEndOnly: true },
  { code: 'MVLOASM', zh: '汽車貸款', en: 'Motor Vehicle Loans' },
];

const debtDefs = ({ code, zh, en, quarterEndOnly }) => {
  const name = `${zh} ${en}`;
  const basis =
    `${code}（百萬美元）÷（所屬季名目 GDP（十億美元，季調年率）× 1000）× 100；債務為存量、GDP 已是年率，不再年化；取 2 位小數。` +
    '所屬季 GDP 尚未公布時，改用最新一季 GDP（check.gdp_fallback 記錄範圍）。' +
    (quarterEndOnly ? '月資料只取季末月（3／6／9／12 月）對該季 GDP。' : '');
  const ratio = (s, digits) => stockToGdp(s[code], s.GDP, { quarterEndOnly, digits });
  const gdpDef = {
    id: `DRV_${code}_GDP`,
    title: `${name} 占 GDP ${en} % of GDP`,
    units: '%',
    inputs: [code, 'GDP'],
    formula: basis,
    compute: (s) => {
      const r = ratio(s, 2);
      return { observations: r.obs, check: { gdp_fallback: r.gdp_fallback } };
    },
  };
  if (code === 'GFDEBTN') {
    gdpDef.checkInputs = ['GFDEGDQ188S'];
    gdpDef.formula += 'check 比對：與 FRED 的 GFDEGDQ188S（聯邦債務占 GDP，季）同日期值；GFDEGDQ188S 只用於 check 比對。';
    const base = gdpDef.compute;
    gdpDef.compute = (s) => {
      const { observations, check } = base(s);
      return { observations, check: { against: 'GFDEGDQ188S', ...diffStats(compare(observations, s.GFDEGDQ188S)), ...check } };
    };
  }
  return [
    yoyDef(`DRV_${code}_YOY`, code, `${name} 年增率 ${en} YoY`),
    gdpDef,
    {
      id: `DRV_${code}_GDP_YOY`,
      title: `${name} 占 GDP 比的年增率 ${en} % of GDP YoY`,
      units: '%',
      inputs: [code, 'GDP'],
      formula:
        `DRV_${code}_GDP（占 GDP 比，此處以 4 位小數計算）的年增率（%）＝ 本期 ÷ 12 個月前同期 − 1，×100；以日期對齊，缺值則略過；取 2 位小數。` +
        `占 GDP 比算法：${basis}`,
      compute: (s) => ({ observations: yoy({ observations: ratio(s, 4).obs }) }),
    },
  ];
};

const DEFS = [
  {
    id: 'DRV_PAYEMS_MOM',
    title: '非農就業 月增減 Nonfarm Payrolls MoM Change',
    units: '千人',
    inputs: ['PAYEMS'],
    formula: 'PAYEMS 月增減（千人）＝ 本月 − 上個月；以日期對齊，上個月缺值則略過。',
    compute: (s) => ({ observations: momChange(s.PAYEMS, 1) }),
  },
  {
    id: 'DRV_PAYEMS_YOY',
    title: '非農就業 年增率 Nonfarm Payrolls YoY',
    units: '%',
    inputs: ['PAYEMS'],
    formula: 'PAYEMS 年增率（%）＝ 本月 ÷ 12 個月前同月 − 1，×100；以日期對齊；取 2 位小數。講義以年增率作圖 [K 26]。',
    compute: (s) => ({ observations: yoy(s.PAYEMS) }),
  },
  {
    id: 'DRV_SAHM',
    title: 'Sahm 規則（自算）Sahm Rule (computed)',
    units: '百分點',
    inputs: ['UNRATE'],
    checkInputs: ['SAHMREALTIME'],
    formula:
      'UNRATE 三個月移動平均（3MA，當月與前 2 個月，三個月都要有值）減去「前 12 個月（t−12～t−1，不含當月）3MA 的最低值」；' +
      '序列開頭前 12 個月不完整時不計算，之後窗口內缺值的 3MA 略過；取 2 位小數。' +
      '窗口定義以三種候選（t−12～t−1／t−11～t／t−12～t）對照 SAHMREALTIME，取平均誤差最小的 t−12～t−1。' +
      'SAHMREALTIME 用每月首次公布的即時失業率，UNRATE 會修正，故兩者有小差異；SAHMREALTIME 只用於 check 比對。' +
      '講義例：2023-10 3MA 3.83 − 前 12 個月最低 3.50 = 0.33 [K 34–36]。',
    compute: (s) => {
      const obs = sahm(s.UNRATE);
      return {
        observations: obs,
        check: { against: 'SAHMREALTIME', ...diffStats(compare(obs, s.SAHMREALTIME)) },
      };
    },
  },
  yoyDef('DRV_CPI_YOY', 'CPIAUCSL', '消費者物價指數 年增率 CPI YoY'),
  yoyDef('DRV_CPICORE_YOY', 'CPILFESL', '核心 CPI 年增率 Core CPI YoY'),
  yoyDef('DRV_PCE_YOY', 'PCEPI', 'PCE 物價指數 年增率 PCE Price Index YoY'),
  yoyDef('DRV_PCECORE_YOY', 'PCEPILFE', '核心 PCE 年增率 Core PCE YoY'),
  yoyDef('DRV_PPI_YOY', 'PPIFIS', '生產者物價指數（最終需求）年增率 PPI Final Demand YoY'),
  yoyDef('DRV_PPIACO_YOY', 'PPIACO', '生產者物價指數（全商品）年增率 PPI All Commodities YoY'),
  {
    id: 'DRV_BBB_AAA',
    title: '信用利差 Baa − Aaa Credit Spread (Baa − Aaa)',
    units: '百分點',
    inputs: ['DBAA', 'DAAA'],
    formula: 'DBAA − DAAA（百分點），日資料；只取兩序列同一日期都有值的日子；取 2 位小數。',
    compute: (s) => {
      const a = valueMap(s.DAAA);
      const obs = [];
      for (const [d, v] of valueMap(s.DBAA)) {
        const w = a.get(d);
        if (w != null) obs.push([d, round(v - w, 2)]);
      }
      return { observations: obs };
    },
  },
  {
    id: 'DRV_DEFICIT_GDP',
    title: '預算赤字占 GDP（近 12 個月）Budget Deficit % of GDP (trailing 12 months)',
    units: '%',
    inputs: ['MTSDS133FMS', 'GDP'],
    checkInputs: ['FYFSGDA188S'],
    formula:
      'MTSDS133FMS（聯邦月收支差額，百萬美元，負值為赤字）近 12 個月合計 ÷（該月所屬季的名目 GDP（十億美元，季調年率）× 1000）× 100；' +
      '12 個月須連續有值；負值為赤字，與 FYFSGDA188S（門檻 −3）同號；取 2 位小數。' +
      '所屬季 GDP 尚未公布時，改用最新一季 GDP（check.gdp_fallback 記錄用到的月份範圍）。' +
      'check 比對：各會計年度 9 月（會計年度 10 月～9 月）的值 vs FYFSGDA188S 同年度值（FRED 以 YYYY-01-01 標示會計年度 YYYY）；' +
      'FYFSGDA188S 分母為會計年度 GDP，本序列用第三季年率 GDP，故有小差異。FYFSGDA188S 只用於 check 比對。',
    compute: (s) => {
      const mts = valueMap(s.MTSDS133FMS);
      const gdp = valueMap(s.GDP);
      const lastGdp = s.GDP.observations.filter(([, v]) => v != null).at(-1);
      const obs = [];
      const fallback = [];
      for (const d of mts.keys()) {
        let sum = 0;
        let full = true;
        for (let k = 0; k < 12; k++) {
          const v = mts.get(addMonths(d, -k));
          if (v == null) {
            full = false;
            break;
          }
          sum += v;
        }
        if (!full) continue;
        let g = gdp.get(quarterStart(d));
        if (g == null) {
          if (quarterStart(d) <= lastGdp[0]) continue; // 歷史中間缺值不補
          g = lastGdp[1];
          fallback.push(d);
        }
        obs.push([d, round((sum / (g * 1000)) * 100, 2)]);
      }
      // 會計年度 YYYY 結束於 YYYY-09
      const fy = valueMap(s.FYFSGDA188S);
      const own = new Map(obs);
      const pairs = [];
      for (const [d, v] of fy) {
        const sep = `${d.slice(0, 4)}-09-01`;
        if (own.has(sep)) pairs.push([own.get(sep), v]);
      }
      const check = { against: 'FYFSGDA188S', basis: '會計年度 9 月值 vs 同年度值', ...diffStats(pairs) };
      check.gdp_fallback = fallback.length ? { gdp_date: lastGdp[0], from: fallback[0], to: fallback.at(-1) } : null;
      return { observations: obs, check };
    },
  },
  {
    id: 'DRV_BEVERIDGE',
    title: 'Beveridge 曲線資料對 Beveridge Curve Pairs',
    units: '[失業率 %, 職缺率 %]',
    inputs: ['UNRATE', 'JTSJOR'],
    formula:
      '每筆為 [日期, UNRATE 失業率, JTSJOR 職缺率]，月資料以日期對齊，只取兩者都有值的月份（JOLTS 自 2000-12 起）；' +
      '畫散佈圖時失業率為 X 軸、職缺率為 Y 軸。',
    compute: (s) => {
      const u = valueMap(s.UNRATE);
      const obs = [];
      for (const [d, v] of valueMap(s.JTSJOR)) {
        const x = u.get(d);
        if (x != null) obs.push([d, x, v]);
      }
      return { observations: obs };
    },
  },
  ...DEBTS.flatMap(debtDefs),
];

// ---- 由日期間距推斷頻率（同 fetch-data.mjs）----
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

// 每筆觀測值一行，方便看 git diff。欄位順序：序列檔欄位 → inputs、formula、check → observations
function serialize(o) {
  const head = ['id', 'title', 'source', 'frequency', 'units', 'substitute', 'last_updated', 'fetched_at', 'inputs', 'formula', 'check']
    .filter((k) => k !== 'check' || o.check !== undefined)
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
  const args = process.argv.slice(2);
  const unknown = args.filter((a) => !DEFS.some((d) => d.id === a));
  if (unknown.length) {
    console.error(`未知的衍生序列：${unknown.join(' ')}`);
    process.exit(1);
  }
  const defs = args.length ? DEFS.filter((d) => args.includes(d.id)) : DEFS;
  const derivedAt = new Date().toISOString().slice(0, 10);
  await mkdir(OUT_DIR, { recursive: true });

  const cache = new Map(); // id -> 序列物件 | Error
  const load = async (id) => {
    if (!cache.has(id)) {
      try {
        cache.set(id, JSON.parse(await readFile(path.join(IN_DIR, `${id}.json`), 'utf8')));
      } catch (e) {
        cache.set(id, new Error(e.code === 'ENOENT' ? `找不到 data/series/${id}.json` : `${id}.json 讀取失敗：${e.message}`));
      }
    }
    return cache.get(id);
  };

  const ok = [];
  const failed = [];
  for (const def of defs) {
    try {
      const s = {};
      for (const id of [...def.inputs, ...(def.checkInputs ?? [])]) {
        const x = await load(id);
        if (x instanceof Error) throw x;
        s[id] = x;
      }
      const { observations, check } = def.compute(s);
      if (observations.length === 0) throw new Error('算出 0 筆觀測值');
      const updates = def.inputs.map((id) => s[id].last_updated).filter(Boolean).sort();
      const out = {
        id: def.id,
        title: def.title,
        source: 'DERIVED',
        frequency: inferFrequency(observations),
        units: def.units,
        substitute: def.inputs.some((id) => s[id].substitute),
        last_updated: updates.at(-1) ?? null,
        fetched_at: derivedAt,
        inputs: def.inputs,
        formula: def.formula,
        check,
        observations,
      };
      const content = serialize(out);
      JSON.parse(content); // 寫檔前自我檢查
      await writeAtomic(path.join(OUT_DIR, `${def.id}.json`), content);
      ok.push(def.id);
      const first = observations[0];
      const last = observations.at(-1);
      const chk = check ? `；check ${JSON.stringify(check)}` : '';
      console.log(`OK   ${def.id}（${observations.length} 筆，${first[0]}～${last[0]}，最新 ${JSON.stringify(last.slice(1))}${chk}）`);
    } catch (e) {
      failed.push({ id: def.id, reason: e.message });
      console.error(`FAIL ${def.id}：${e.message}`);
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
