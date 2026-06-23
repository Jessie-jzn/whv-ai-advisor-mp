/**
 * Specified Work 资格查询引擎
 */
import {
  POSTCODE_INDEX,
  TOURISM_SPECIAL_INDEX,
} from "../data/postcodeIndex.js";

const NORFOLK_POSTCODES = [2899];

export const TARGET_DAYS_SECOND = 88;
export const TARGET_DAYS_THIRD = 179;

export const AREA_LABELS = {
  // 偏远 / 极偏远地区
  remote: "Remote / Very Remote 偏远/极偏远地区",
  // 澳大利亚北部地区
  northern: "Northern Australia 北领地",
  // 澳大利亚偏远地区 / 地区性澳洲
  regional: "Regional Australia 偏远地区",
  // 山火恢复地区
  bushfire: "Bushfire Recovery 山火恢复地区",
  // 自然灾害恢复地区
  natural: "Natural Disaster Recovery 自然灾害恢复地区",
};

/** 

 * Industry → Eligible areas

 * 行业 → 可计入集签的区域

 */

export const INDUSTRY_AREA_MAP = {
  // 旅游与酒店餐饮业 → 偏远/极偏远地区、澳大利亚北部地区
  tourism_hospitality: ["remote", "northern"],
  // 植物与动物养殖业 / 农牧业 → 澳大利亚北部地区、澳大利亚偏远地区
  plant_animal: ["northern", "regional"],
  // 渔业与珍珠养殖业 → 澳大利亚北部地区
  fishing: ["northern"],
  // 林业与伐木业 → 澳大利亚北部地区
  forestry: ["northern"],
  // 建筑业 → 澳大利亚北部地区、澳大利亚偏远地区、山火恢复地区、自然灾害恢复地区
  construction: ["northern", "regional", "bushfire", "natural"],
  // 山火恢复工作 → 山火恢复地区
  bushfire_recovery: ["bushfire"],
  // 自然灾害恢复工作 → 自然灾害恢复地区
  disaster_recovery: ["natural"],
  // COVID-19 医疗健康相关工作 → 所有符合要求的地区
  covid_healthcare: ["*"],
};

export const INDUSTRY_LABELS = {
  tourism_hospitality: "旅游 / 餐饮 / 酒店",
  plant_animal: "农牧 / 采摘 / 畜牧",
  fishing: "渔业 / 珍珠",
  forestry: "林业 / 采伐",
  construction: "建筑 / 工地",
  bushfire_recovery: "山火重建",
  disaster_recovery: "灾害重建",
  covid_healthcare: "COVID-19 医疗",
};

/** 旧 industry id → 官方 id */
export const LEGACY_INDUSTRY_MAP = {
  farm: "plant_animal",
  hospitality: "tourism_hospitality",
  tourism: "tourism_hospitality",
};

export const EMPLOYMENT_TYPES = [
  { id: "paid", label: "有偿工作" },
  { id: "volunteer", label: "志愿工作（灾害重建）" },
];

export const VISA_AT_WORK_OPTS = [
  { id: "462_first", label: "462 一签" },
  { id: "462_second", label: "462 二签" },
  { id: "417_first", label: "417 一签" },
  { id: "417_second", label: "417 二签" },
  { id: "bridging", label: "Bridging 签证" },
  { id: "408_covid", label: "408 COVID 签证" },
];

export function normalizeIndustry(id) {
  if (!id) return "";
  return LEGACY_INDUSTRY_MAP[id] || id;
}

export function inferStateFromPostcode(pc) {
  const p = parseInt(String(pc).replace(/\D/g, ""), 10);
  if (Number.isNaN(p)) return null;
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

export function lookupPostcode(raw) {
  const pc = String(raw || "").replace(/\D/g, "");
  if (pc.length < 3) return null;
  const key = pc.padStart(4, "0").slice(-4);
  const entry = POSTCODE_INDEX[key];
  if (!entry) return null;
  return {
    postcode: key,
    state: entry.s,
    areas: [...entry.a],
    tourismSpecial: !!TOURISM_SPECIAL_INDEX[key],
  };
}

export function getEligibleIndustriesForAreas(areas) {
  const set = new Set();
  Object.entries(INDUSTRY_AREA_MAP).forEach(([industry, allowed]) => {
    if (allowed.includes("*")) {
      set.add(industry);
      return;
    }
    if (allowed.some((a) => areas.includes(a))) set.add(industry);
  });
  return [...set];
}

/**
 * @param {string|number} postcode
 * @param {string} industry - 官方或 legacy id
 * @param {{ employmentType?: string }} [opts]
 */
export function checkEligibility(postcode, industry, opts = {}) {
  const warnings = [];
  const normalized = normalizeIndustry(industry);
  const info = lookupPostcode(postcode);
  const state = info?.state || inferStateFromPostcode(postcode);

  if (!normalized) {
    return { eligible: false, state, areas: [], industries: [], warnings: ["请选择行业"] };
  }

  if (normalized === "covid_healthcare") {
    return {
      eligible: true,
      state: state || "AU",
      areas: ["*"],
      industries: [normalized],
      warnings: ["须为 2020-01-31 后 COVID-19 关键医疗岗位，需保留证明材料"],
    };
  }

  if (!info) {
    warnings.push("邮编未命中官方 eligible 列表，递签前务必核实");
    return { eligible: false, state, areas: [], industries: [], warnings };
  }

  const areas = info.areas;
  const allowedAreas = INDUSTRY_AREA_MAP[normalized] || [];
  let eligible = allowedAreas.some((a) => areas.includes(a));

  if (!eligible && normalized === "tourism_hospitality" && info.tourismSpecial) {
    eligible = true;
    warnings.push("命中 Table 2 旅游餐饮特殊邮编");
  }

  const empType = opts.employmentType || "paid";
  if (
    empType === "volunteer" &&
    (normalized === "bushfire_recovery" || normalized === "disaster_recovery")
  ) {
    const need = normalized === "bushfire_recovery" ? "bushfire" : "natural";
    eligible = areas.includes(need);
    if (eligible) warnings.push("志愿灾害重建可计入，ImmiAccount 需选 flood recovery - volunteer");
  }

  if (eligible && ["tourism_hospitality", "plant_animal", "construction"].includes(normalized)) {
    warnings.push("行业支持岗位（行政、清洁等）在 eligible 邮编内可能可计入");
  }

  if (!eligible) {
    warnings.push(
      `区域（${areas.map((a) => AREA_LABELS[a] || a).join("、")}）不支持「${INDUSTRY_LABELS[normalized] || normalized}」`
    );
  }

  return {
    eligible,
    state: info.state,
    postcode: info.postcode,
    areas,
    industries: getEligibleIndustriesForAreas(areas),
    warnings,
  };
}

export function getAreaColor(area) {
  const map = {
    remote: "#1b4332",
    northern: "#2c5f2e",
    regional: "#52b788",
    bushfire: "#c0392b",
    natural: "#d4831a",
  };
  return map[area] || "#6b6b6b";
}

export function calcCalendarSpan(records) {
  const withDates = (records || []).filter((r) => r.startDate && r.endDate);
  if (!withDates.length) return 0;
  let min = Infinity;
  let max = -Infinity;
  withDates.forEach((r) => {
    const s = new Date(r.startDate).getTime();
    const e = new Date(r.endDate).getTime();
    if (s < min) min = s;
    if (e > max) max = e;
  });
  if (!Number.isFinite(min)) return 0;
  return Math.ceil((max - min) / 86400000) + 1;
}

export function calcRecordEffectiveDays(record) {
  const daysWorked = Number(record.daysWorked) || 0;
  if (daysWorked <= 0) return 0;

  const weeklyDays = Number(record.weeklyDays) || 5;
  const industry = normalizeIndustry(record.industry);
  const isVolunteerRecovery =
    record.employmentType === "volunteer" &&
    (industry === "bushfire_recovery" || industry === "disaster_recovery");

  if (isVolunteerRecovery) return daysWorked;

  const fteRatio = Math.min(weeklyDays / 5, 1);
  return Math.round(daysWorked * fteRatio * 10) / 10;
}

export function enrichWorkRecord(record) {
  const industry = normalizeIndustry(record.industry);
  const postcode = record.postcode || extractPostcode(record.location);
  const check = postcode
    ? checkEligibility(postcode, industry, { employmentType: record.employmentType })
    : { eligible: null, areas: [], warnings: ["未填写邮编，无法自动判定"] };

  let calendarDays = 0;
  if (record.startDate && record.endDate) {
    calendarDays =
      Math.ceil(
        (new Date(record.endDate) - new Date(record.startDate)) / 86400000
      ) + 1;
  }

  const effectiveDays = check.eligible === false ? 0 : calcRecordEffectiveDays(record);

  return {
    ...record,
    industry,
    postcode: postcode || record.postcode || "",
    matchedAreas: check.areas || [],
    eligible: check.eligible,
    eligibleWarnings: check.warnings || [],
    calendarDays,
    effectiveDays,
    countedDays: check.eligible ? effectiveDays : 0,
  };
}

function extractPostcode(location) {
  const m = String(location || "").match(/\b(\d{4})\b/);
  return m ? m[1] : "";
}

export function calcWorkProgress(records = [], target = TARGET_DAYS_SECOND) {
  const enriched = records.map((r) =>
    r.countedDays != null && r.eligible != null ? r : enrichWorkRecord(r)
  );

  const rawDays = enriched.reduce((s, r) => s + (Number(r.daysWorked) || 0), 0);
  const eligibleDays = enriched.reduce((s, r) => s + (Number(r.countedDays) || 0), 0);
  const totalHours = enriched.reduce((s, r) => s + (Number(r.hours) || 0), 0);
  const totalIncome = enriched.reduce(
    (s, r) => s + (Number(r.earnings) || (Number(r.hours) || 0) * 28),
    0
  );
  const calendarSpan = calcCalendarSpan(enriched);
  const remaining = Math.max(0, target - eligibleDays);
  const percent = Math.min(100, Math.round((eligibleDays / target) * 100));
  const calendarOk = calendarSpan >= target;

  const warnings = [];
  if (!calendarOk && eligibleDays >= target * 0.8) {
    warnings.push(`日历跨度 ${calendarSpan} 天，可能不足 ${target} 天最低要求`);
  }
  enriched.filter((r) => r.eligible === false).forEach((r) => {
    warnings.push(`${r.employer || "记录"}：邮编/行业不匹配，未计入`);
  });

  return {
    rawDays,
    eligibleDays,
    totalDays: eligibleDays,
    totalHours,
    totalIncome,
    calendarSpan,
    calendarOk,
    remaining,
    percent,
    target,
    warnings,
    records: enriched,
  };
}

export function searchPostcodeOnly(query) {
  const q = String(query || "").trim();
  const pcMatch = q.match(/\b(\d{3,4})\b/);
  if (!pcMatch) return null;
  const info = lookupPostcode(pcMatch[1]);
  if (!info) {
    return {
      postcode: pcMatch[1].padStart(4, "0"),
      state: inferStateFromPostcode(pcMatch[1]),
      areas: [],
      industries: [],
      found: false,
    };
  }
  return {
    ...info,
    industries: getEligibleIndustriesForAreas(info.areas),
    found: true,
  };
}
