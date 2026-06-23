import { WHV_TOWNS } from "../data/whvTowns.js";
import { askCloudRouter, hasCloudRouter, pingCloudRouter } from "./cloudRouter.js";
import { findTownById, searchTowns, searchPostcodeOnly } from "./townLookup.js";
import { getStorageJson, setStorageJson } from "./storage.js";
import { parseRawLlmJson } from "./llmJson.js";

const CACHE_KEY = "postcodeAiCache";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function parsePostcodeQuery(query) {
  const q = String(query || "").trim();
  const m = q.match(/\b(\d{4})\b/);
  if (!m) return null;
  return m[1];
}

function readCache() {
  return getStorageJson(CACHE_KEY, {});
}

function writeCache(data) {
  setStorageJson(CACHE_KEY, data);
}

function getCached(postcode) {
  const bucket = readCache();
  const entry = bucket[postcode];
  if (!entry || Date.now() - entry.ts > CACHE_TTL_MS) return null;
  return entry.json;
}

function putCache(postcode, json) {
  const bucket = readCache();
  bucket[postcode] = { json, ts: Date.now() };
  const keys = Object.keys(bucket);
  if (keys.length > 50) {
    keys
      .sort((a, b) => (bucket[a].ts || 0) - (bucket[b].ts || 0))
      .slice(0, keys.length - 50)
      .forEach((k) => delete bucket[k]);
  }
  writeCache(bucket);
}

function parsePostcodeAiJson(text) {
  const obj = typeof text === "object" && text !== null ? text : parseRawLlmJson(text);
  if (!obj || !Array.isArray(obj.localities)) {
    throw new Error("missing localities array");
  }
  return obj;
}

function buildPostcodeAiPrompt(postcode, eligibility) {
  const system =
    "你是澳大利亚地理与 WHV 集签助手。根据邮编识别对应的城镇/郊区/locality。严格返回 JSON，不要 markdown。";

  const schema = `JSON 结构:
{
  "postcode": "${postcode}",
  "localities": [
    {
      "name": "英文地名（如 Bundaberg 或 suburb 名）",
      "cnName": "中文常用译名（如有）",
      "state": "QLD/NSW/VIC/SA/WA/NT/TAS/ACT",
      "type": "city|town|suburb|locality",
      "isPrimary": true
    }
  ],
  "summary": "一句话说明该邮编主要覆盖哪些区域（中文）",
  "whvNote": "与打工度假 specified work 相关的简短提示（中文，无则空字符串）"
}
要求: localities 1-3 个，按重要性排序；isPrimary 仅一个 true；地名必须真实准确。`;

  const user = JSON.stringify({
    postcode,
    known_eligibility: eligibility?.found
      ? { state: eligibility.state, areas: eligibility.areas }
      : null,
    hint: "可参考 Australia Post 邮编归属，优先给出背包客熟悉的城镇名。",
  });

  return { system: `${system}\n\n${schema}`, user };
}

function normalizeName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function findTownByNameAndState(name, state) {
  const n = normalizeName(name);
  if (!n) return null;
  return (
    WHV_TOWNS.find(
      (t) =>
        normalizeName(t.name) === n &&
        (!state || t.state === state)
    ) ||
    WHV_TOWNS.find(
      (t) =>
        (normalizeName(t.name).includes(n) || n.includes(normalizeName(t.name))) &&
        (!state || t.state === state)
    ) ||
    WHV_TOWNS.find((t) => t.cnName && t.cnName.includes(name))
  );
}

function findTownsByPostcode(postcode) {
  const pc = String(postcode).padStart(4, "0");
  return WHV_TOWNS.filter((t) =>
    (t.postcodes || []).some((p) => String(p).padStart(4, "0") === pc)
  );
}

/**
 * 同步：本地邮编 + 城镇库解析
 */
export function resolvePostcodeSearch(query, options = {}) {
  const postcode = parsePostcodeQuery(query);
  const isPostcodeQuery = !!postcode;

  const eligibility = isPostcodeQuery ? searchPostcodeOnly(postcode) : null;

  let dbTowns = [];
  if (options.townId) {
    const t = findTownById(options.townId);
    if (t) dbTowns = [t];
  } else if (isPostcodeQuery) {
    dbTowns = findTownsByPostcode(postcode);
  } else {
    dbTowns = searchTowns(query);
  }

  const items = dbTowns.map((town) => ({
    key: `db-${town.id}`,
    source: "database",
    town,
    aiLocality: null,
    matched: true,
  }));

  return {
    query,
    postcode: isPostcodeQuery ? String(postcode).padStart(4, "0") : null,
    isPostcodeQuery,
    eligibility,
    items,
    ai: null,
    aiLoading: false,
    aiError: null,
  };
}

/**
 * 合并 AI 识别结果与本地城镇库
 */
export function mergePostcodeAiResult(base, aiJson, meta = {}) {
  if (!aiJson) return base;

  const pc = base.postcode;
  const seenIds = new Set(base.items.map((i) => i.town.id));
  const mergedItems = [...base.items];

  (aiJson.localities || []).forEach((loc, idx) => {
    const name = String(loc.name || "").trim();
    if (!name) return;

    const state = String(loc.state || base.eligibility?.state || "").trim();
    let matched = findTownByNameAndState(name, state);
    if (!matched && pc) {
      matched = findTownsByPostcode(pc).find(
        (t) => normalizeName(t.name) === normalizeName(name)
      );
    }

    if (matched && seenIds.has(matched.id)) {
      mergedItems.forEach((item) => {
        if (item.town.id === matched.id) {
          item.source = "merged";
          item.aiLocality = loc;
          item.matched = true;
        }
      });
      return;
    }

    if (matched) {
      seenIds.add(matched.id);
      mergedItems.unshift({
        key: `merged-${matched.id}`,
        source: "merged",
        town: matched,
        aiLocality: loc,
        matched: true,
      });
      return;
    }

    const virtualTown = {
      id: `ai-${pc || "x"}-${idx}`,
      name,
      cnName: String(loc.cnName || "").trim(),
      state: state || base.eligibility?.state || "",
      postcodes: pc ? [Number(pc)] : [],
      categories: [],
      industries: [],
      transportFriendly: false,
      climate: "",
      coastal: false,
      backpackerHub: false,
      pros: [],
      _aiGenerated: true,
    };

    mergedItems.push({
      key: virtualTown.id,
      source: "ai",
      town: virtualTown,
      aiLocality: loc,
      matched: false,
    });
  });

  mergedItems.sort((a, b) => {
    const rank = { merged: 0, database: 1, ai: 2 };
    const sa = a.aiLocality?.isPrimary ? -1 : rank[a.source] ?? 3;
    const sb = b.aiLocality?.isPrimary ? -1 : rank[b.source] ?? 3;
    return sa - sb;
  });

  return {
    ...base,
    items: mergedItems,
    ai: {
      summary: String(aiJson.summary || "").trim(),
      whvNote: String(aiJson.whvNote || "").trim(),
      localities: aiJson.localities || [],
      provider: meta.provider || "cloud",
      model: meta.model || "",
      cached: !!meta.cached,
    },
    aiLoading: false,
    aiError: null,
  };
}

/**
 * 异步：调用 AI  enrich 邮编搜索结果
 */
export async function enrichPostcodeWithAi(base) {
  if (!base.isPostcodeQuery || !base.postcode) {
    return { ...base, aiLoading: false };
  }

  if (!hasCloudRouter()) {
    return {
      ...base,
      aiLoading: false,
      aiError: null,
      ai: null,
    };
  }

  const cached = getCached(base.postcode);
  if (cached) {
    return mergePostcodeAiResult(base, cached, { cached: true, provider: "cache" });
  }

  const ping = await pingCloudRouter();

  try {
    if (!ping.ok) {
      throw new Error(ping.error || "无法连接 Worker");
    }

    const { system, user } = buildPostcodeAiPrompt(base.postcode, base.eligibility);
    const { json, provider, model } = await askCloudRouter({
      system,
      user,
      purpose: "fast",
      parseFn: parsePostcodeAiJson,
    });
    putCache(base.postcode, json);
    return mergePostcodeAiResult(base, json, { provider, model, pingOk: true });
  } catch (e) {
    const detail = e?.message || "AI 查询失败";
    const aiError = ping.ok
      ? `Worker 在线，但 AI 接口（/v1/ai/chat）失败：${detail}`
      : detail;
    return {
      ...base,
      aiLoading: false,
      aiError,
      aiPingOk: ping.ok,
      ai: null,
    };
  }
}

export function getSourceLabel(source) {
  const map = {
    merged: "AI + 知识库",
    database: "知识库",
    ai: "AI 识别",
  };
  return map[source] || source;
}
