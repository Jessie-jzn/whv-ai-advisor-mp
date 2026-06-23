/**
 * 构建邮编索引 — npm run build:postcodes
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const {
  POSTCODE_RULES,
  STATE_ALL_AREAS,
  STATE_POSTCODE_RANGES,
  TOURISM_SPECIAL,
  NORFOLK_POSTCODES,
} = require("../src/data/postcodeRules.js");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../src/data/postcodeIndex.js");

function expandRange([from, to]) {
  const out = [];
  for (let i = from; i <= to; i += 1) out.push(i);
  return out;
}

function inferState(pc) {
  const p = Number(pc);
  if (p >= 200 && p <= 299) return "ACT";
  if (p >= 800 && p <= 999) return "NT";
  if ((p >= 1000 && p <= 2599) || (p >= 2619 && p <= 2899)) return "NSW";
  if (p >= 3000 && p <= 3999) return "VIC";
  if (p >= 4000 && p <= 4999) return "QLD";
  if (p >= 5000 && p <= 5799) return "SA";
  if (p >= 6000 && p <= 6797) return "WA";
  if (p >= 7000 && p <= 7799) return "TAS";
  if (NORFOLK_POSTCODES.includes(p)) return "NF";
  return null;
}

function addToIndex(index, pc, state, area) {
  const key = String(pc).padStart(4, "0");
  if (!index[key]) index[key] = { s: state, a: [] };
  if (!index[key].a.includes(area)) index[key].a.push(area);
}

function applyRule(index, rule) {
  const { area, state, lists = [], ranges = [], all = false } = rule;

  if (all) {
    const rangesForState = STATE_POSTCODE_RANGES[state];
    if (rangesForState) {
      rangesForState.forEach((r) => {
        expandRange(r).forEach((pc) => addToIndex(index, pc, state, area));
      });
    }
    return;
  }

  lists.forEach((pc) => {
    const st = state === "NF" ? "NF" : inferState(pc) || state;
    addToIndex(index, pc, st, area);
  });
  ranges.forEach((r) => {
    expandRange(r).forEach((pc) => {
      const st = inferState(pc) || state;
      addToIndex(index, pc, st, area);
    });
  });
}

function applyStateAllAreas(index) {
  Object.entries(STATE_ALL_AREAS).forEach(([state, areas]) => {
    const ranges = STATE_POSTCODE_RANGES[state];
    if (!ranges) return;
    areas.forEach((area) => {
      ranges.forEach((r) => {
        expandRange(r).forEach((pc) => addToIndex(index, pc, state, area));
      });
    });
  });
}

const index = {};
POSTCODE_RULES.forEach((rule) => applyRule(index, rule));
applyStateAllAreas(index);

// 旅游特殊邮编标记（存 meta，查询时用）
const tourismSpecial = {};
Object.entries(TOURISM_SPECIAL).forEach(([state, codes]) => {
  codes.forEach((pc) => {
    const key = String(pc).padStart(4, "0");
    tourismSpecial[key] = state;
    addToIndex(index, pc, state, "remote");
  });
});

const sorted = Object.keys(index).sort();
const compact = {};
sorted.forEach((k) => {
  compact[k] = index[k];
});

const header = `/**
 * AUTO-GENERATED — 请勿手动编辑
 * 生成：npm run build:postcodes
 * 邮编数：${sorted.length}
 */
`;

const body = `export const POSTCODE_INDEX = ${JSON.stringify(compact)};

export const TOURISM_SPECIAL_INDEX = ${JSON.stringify(tourismSpecial)};

export const POSTCODE_COUNT = ${sorted.length};
`;

fs.writeFileSync(OUT, header + body, "utf8");
console.log(`✓ postcodeIndex.js — ${sorted.length} postcodes`);

// 抽样验证
const sample = ["4670", "4870", "2000", "0800", "7215"];
sample.forEach((pc) => {
  const e = compact[pc];
  console.log(`  ${pc}: ${e ? e.a.join(", ") : "NOT FOUND"}`);
});
