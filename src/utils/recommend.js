import { WHV_TOWNS, STATE_NEIGHBORS } from "../data/whvTowns.js";
import { normalizeIndustry } from "./eligibility.js";
import { getTownAreas } from "./townLookup.js";

function detectStateFromLocation(location) {
  if (!location) return null;
  const raw = location.toLowerCase();
  const numeric = raw.match(/\b(\d{3,4})\b/);
  if (numeric) {
    const p = parseInt(numeric[1], 10);
    if (p >= 200 && p <= 299) return "ACT";
    if (p >= 800 && p <= 899) return "NT";
    if ((p >= 1000 && p <= 2599) || (p >= 2619 && p <= 2899)) return "NSW";
    if (p >= 3000 && p <= 3999) return "VIC";
    if (p >= 4000 && p <= 4999) return "QLD";
    if (p >= 5000 && p <= 5799) return "SA";
    if (p >= 6000 && p <= 6797) return "WA";
    if (p >= 7000 && p <= 7799) return "TAS";
  }
  const map = [
    { state: "QLD", keys: ["brisbane", "qld", "queensland", "cairns", "gold coast", "布里斯班", "昆士兰", "凯恩斯", "黄金海岸"] },
    { state: "NSW", keys: ["sydney", "nsw", "new south wales", "悉尼", "新南威尔士"] },
    { state: "VIC", keys: ["melbourne", "vic", "victoria", "墨尔本", "维多利亚"] },
    { state: "SA", keys: ["adelaide", "sa", "south australia", "阿德莱德", "南澳"] },
    { state: "WA", keys: ["perth", "wa", "western australia", "珀斯", "西澳"] },
    { state: "NT", keys: ["darwin", "nt", "northern territory", "达尔文", "北领地"] },
    { state: "TAS", keys: ["hobart", "tas", "tasmania", "塔斯", "霍巴特"] },
    { state: "ACT", keys: ["canberra", "act", "堪培拉"] },
  ];
  for (const item of map) {
    if (item.keys.some((k) => raw.includes(k))) return item.state;
  }
  return null;
}

function extractNoteHints(notes) {
  const text = (notes || "").toLowerCase();
  return {
    farm: /(farm|farming|pick|picker|picking|harvest|农场|采摘|果园|果场)/.test(text),
    hospitality: /(hospitality|cafe|restaurant|kitchen|waiter|hotel|housekeep|餐饮|酒店|餐厅|咖啡|厨房|服务员)/.test(text),
    construction: /(construction|build|tradie|建筑|工地)/.test(text),
    tourism: /(tourism|tour|backpacker|hostel|旅游|背包客|青旅)/.test(text),
    fishing: /(fish|fishing|渔)/.test(text),
    mining: /(mine|mining|矿)/.test(text),
    warm: /(warm|tropical|hot|sun|暖|热带|阳光)/.test(text),
    cool: /(cool|cold|mild|凉|冷|温和)/.test(text),
    coastal: /(beach|coast|ocean|sea|海边|沿海|海)/.test(text),
    budget: /(budget|cheap|affordable|预算|便宜|省钱)/.test(text),
    noCar: /(no car|without car|public transport|不会开车|没车|不开车|公交|巴士|火车)/.test(text),
    community: /(chinese|asian|community|华人|亚洲)/.test(text),
  };
}

export function pickRelevantPros(town, activeTags, locale, maxCount) {
  const tagSet = new Set(activeTags);
  const scored = town.pros.map((pro) => ({
    pro,
    hits: pro.tags.filter((t) => tagSet.has(t)).length,
  }));
  scored.sort((a, b) => b.hits - a.hits);
  const out = [];
  for (const { pro, hits } of scored) {
    if (out.length >= maxCount) break;
    if (hits > 0 || out.length < maxCount) {
      out.push(pro[locale]);
    }
  }
  return out;
}

export function recommendWhvTowns({ currentLocation, canDrive, goal, industry, notes }) {
  const wantsEligibility = goal === "second" || goal === "third";
  const hints = extractNoteHints(notes);
  const effectiveNoCar = !canDrive || hints.noCar;
  const userState = detectStateFromLocation(currentLocation);
  const industryHints = ["farm", "hospitality", "construction", "tourism", "fishing", "mining"].filter(
    (k) => hints[k]
  );

  const scored = WHV_TOWNS.map((town) => {
    let score = 0;
    const activeTags = [];

    if (wantsEligibility) {
      const areas = getTownAreas(town);
      if (areas.length === 0) {
        score -= 50;
      } else {
        score += 6;
        activeTags.push("eligibility");
        if (goal === "second") activeTags.push("second");
        if (goal === "third" && (areas.includes("remote") || areas.includes("northern") || areas.includes("regional"))) {
          score += 4;
          activeTags.push("third");
        }
      }
    }

    if (effectiveNoCar) {
      if (town.transportFriendly) {
        score += 12;
        activeTags.push("transport");
      } else {
        score -= 9;
      }
    } else if (!town.transportFriendly) {
      score += 1;
    }

    if (industry && industry !== "any") {
      const norm = normalizeIndustry(industry);
      const match = town.industries.some((i) => normalizeIndustry(i) === norm);
      if (match) {
        score += 9;
        activeTags.push(industry);
      } else {
        score -= 4;
      }
    } else {
      score += town.industries.length;
      if (town.backpackerHub) score += 2;
    }

    industryHints.forEach((k) => {
      if (town.industries.includes(k)) {
        score += 4;
        activeTags.push(k);
      }
    });

    if (hints.warm && (town.climate === "tropical" || town.climate === "subtropical")) score += 3;
    if (hints.cool && (town.climate === "cool" || town.climate === "temperate")) score += 3;
    if (hints.coastal && town.coastal) score += 2;
    if (hints.budget && town.backpackerHub) score += 1;
    if (hints.community && (town.id === "darwin" || town.id === "cairns")) score += 1;

    if (userState && town.state === userState) {
      score += 3;
      activeTags.push("nearby");
    } else if (userState && (STATE_NEIGHBORS[userState] || []).includes(town.state)) {
      score += 1;
    }

    return { town, score, activeTags };
  });

  scored.sort((a, b) => b.score - a.score);
  const positives = scored.filter((item) => item.score > 0);
  const result = [];
  const stateCount = {};
  const MAX_PER_STATE = 3;
  for (const item of positives) {
    if (result.length >= 5) break;
    const c = stateCount[item.town.state] || 0;
    if (c >= MAX_PER_STATE) continue;
    result.push(item);
    stateCount[item.town.state] = c + 1;
  }
  if (result.length < 5) {
    for (const item of positives) {
      if (result.length >= 5) break;
      if (!result.includes(item)) result.push(item);
    }
  }
  return result;
}
