import { WHV_TOWNS } from "../data/whvTowns.js";
import {
  lookupPostcode,
  checkEligibility,
  getEligibleIndustriesForAreas,
  AREA_LABELS,
  INDUSTRY_LABELS as OFFICIAL_INDUSTRY_LABELS,
  LEGACY_INDUSTRY_MAP,
  normalizeIndustry,
  searchPostcodeOnly,
} from "./eligibility.js";

export const CATEGORY_LABELS = {
  regional: "Regional Australia（指定区域）",
  northern: "Northern Australia（北部）",
  remote: "Remote / Very Remote（偏远）",
  natural: "Natural Disaster Recovery（灾害重建）",
  bushfire: "Bushfire Recovery（山火重建）",
};

export const INDUSTRY_LABELS = {
  ...OFFICIAL_INDUSTRY_LABELS,
  farm: "农牧 / 采摘",
  hospitality: "餐饮 / 酒店",
  tourism: "旅游",
};

const CLIMATE_LABELS = {
  tropical: "热带",
  subtropical: "亚热带",
  temperate: "温带",
  cool: "凉爽",
  arid: "干旱",
};

/** 合并城镇标注 + 邮编索引的区域 */
export function getTownAreas(town) {
  const areas = new Set(town.categories || []);
  (town.postcodes || []).forEach((pc) => {
    const info = lookupPostcode(pc);
    if (info) info.areas.forEach((a) => areas.add(a));
  });
  return [...areas];
}

export function getTownIndustries(town) {
  const areas = getTownAreas(town);
  const fromIndex = getEligibleIndustriesForAreas(areas);
  const legacy = (town.industries || []).map((i) => normalizeIndustry(i));
  return [...new Set([...fromIndex, ...legacy])];
}

export function searchTowns(query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return [];

  const postcodeMatch = q.match(/\b(\d{3,4})\b/);
  const postcode = postcodeMatch ? postcodeMatch[1] : null;

  if (postcode) {
    const pcInfo = searchPostcodeOnly(postcode);
    if (pcInfo?.found) {
      const byPostcode = WHV_TOWNS.filter((town) =>
        town.postcodes.some((p) => String(p).padStart(4, "0") === pcInfo.postcode)
      );
      if (byPostcode.length) return byPostcode;
    }
  }

  return WHV_TOWNS.filter((town) => {
    if (postcode && town.postcodes.some((p) => String(p).includes(postcode))) return true;
    if (town.name.toLowerCase().includes(q)) return true;
    if (town.cnName && town.cnName.includes(q)) return true;
    if (town.state.toLowerCase() === q) return true;
    if (town.id.includes(q.replace(/\s+/g, ""))) return true;
    return false;
  });
}

export function getPopularTowns(limit = 6) {
  return [...WHV_TOWNS]
    .filter((t) => t.backpackerHub && getTownAreas(t).length > 0)
    .sort((a, b) => getTownIndustries(b).length - getTownIndustries(a).length)
    .slice(0, limit);
}

export function getDisplayName(town) {
  return town.cnName ? `${town.cnName} (${town.name})` : town.name;
}

export function getRegionTypes(town) {
  return getTownAreas(town).map((c) => CATEGORY_LABELS[c] || AREA_LABELS[c] || c);
}

export function getApplicableVisas(town) {
  const cats = getTownAreas(town);
  const visas = [];
  if (cats.length) visas.push("WHV 二签（Specified Work 88 天）");
  if (cats.includes("northern") || cats.includes("remote") || cats.includes("regional")) {
    visas.push("WHV 三签（179 天，2019-07-01 后工作）");
  }
  if (cats.includes("bushfire")) visas.push("山火重建志愿/有偿工作");
  if (cats.includes("natural")) visas.push("灾害重建志愿/有偿工作（2025-04-05 后递签）");
  if (!visas.length) visas.push("邮编未命中官方列表，递签前务必核实");
  return visas;
}

export function getCommonJobs(town) {
  return getTownIndustries(town).map((i) => INDUSTRY_LABELS[i] || OFFICIAL_INDUSTRY_LABELS[i] || i);
}

export function getRiskTips(town) {
  const tips = [];
  const areas = getTownAreas(town);
  if (!areas.length) {
    tips.push("⚠️ 未命中已知集签类别，邮编可能不计入指定工作");
  }
  if (!town.transportFriendly) {
    tips.push("无车党需提前确认巴士/工头接送，否则通勤成本高");
  }
  if (town.climate === "tropical" || town.climate === "subtropical") {
    tips.push("热带地区注意防暑、蛇虫与雨季安全");
  }
  const industries = getTownIndustries(town);
  if (industries.includes("plant_animal") || town.industries?.includes("farm")) {
    tips.push("农场工注意合同、工时记录与 Payslip 留存");
  }
  if (
    (industries.includes("tourism_hospitality") || town.industries?.includes("hospitality")) &&
    !areas.includes("remote") &&
    !areas.includes("northern")
  ) {
    tips.push("纯 hospitality 在 regional 邮编可能不计入，请核对行业与区域");
  }
  if (!tips.length) tips.push("递签前请保留 Payslip / Bank Statement 等证明材料");
  return tips;
}

export function getTownSummary(town) {
  const parts = [`${town.state}`, CLIMATE_LABELS[town.climate] || town.climate];
  if (town.coastal) parts.push("沿海");
  if (town.backpackerHub) parts.push("背包客聚集");
  const areas = getTownAreas(town);
  if (areas.length) parts.push(`${areas.length} 类指定区域`);
  return parts.filter(Boolean).join(" · ");
}

export function getPostcodeEligibilityForTown(town, industry) {
  const pc = town.postcodes?.[0];
  if (!pc) return null;
  const ind = industry || normalizeIndustry(town.industries?.[0]);
  return checkEligibility(pc, ind);
}

export function findTownById(id) {
  return WHV_TOWNS.find((t) => t.id === id) || null;
}

export { searchPostcodeOnly, checkEligibility, lookupPostcode, AREA_LABELS, LEGACY_INDUSTRY_MAP };
