import { WHV_TOWNS } from "../data/whvTowns.js";
import { askCloudRouter } from "./cloudRouter.js";

function buildLlmPrompt(inputs, locale) {
  const localCorpus = WHV_TOWNS.map((t) => ({
    name: t.name,
    state: t.state,
    postcodes: t.postcodes,
    industries: t.industries,
    transportFriendly: t.transportFriendly,
    categories: t.categories,
  }));

  const isZh = locale === "zh";
  const system = isZh
    ? "你是澳大利亚 Working Holiday Visa(WHV)集签规划助手。基于用户的情况,给出最适合先看的 3-5 个城镇。必须严格返回 JSON,不要任何 markdown / 代码块 / 解释文字。"
    : "You are an Australian Working Holiday Visa (WHV) planning assistant. Recommend 3 to 5 towns the user should look at first, based on their situation. Return STRICT JSON only — no markdown, no code fences, no commentary.";

  const schemaInstr = isZh
    ? `JSON 结构:
{
  "summary": "一句话总结建议方向,用中文。",
  "recommendations": [
    {
      "name": "城镇英文名",
      "state": "QLD/NSW/VIC/SA/WA/NT/TAS/ACT 之一",
      "postcodes": [4670, 4671],
      "reasons": ["原因 1(中文,具体可执行)", "原因 2", "原因 3"]
    }
  ]
}
要求:每个推荐 2-3 条具体原因。优先用 LOCAL_TOWNS 里的邮编。`
    : `JSON shape:
{
  "summary": "One-sentence rationale in English.",
  "recommendations": [
    {
      "name": "Town name",
      "state": "QLD/NSW/VIC/SA/WA/NT/TAS/ACT",
      "postcodes": [4670, 4671],
      "reasons": ["concrete reason 1", "reason 2", "reason 3"]
    }
  ]
}
Requirements: 2-3 concrete reasons per town. Prefer postcodes from LOCAL_TOWNS.`;

  const user = JSON.stringify({
    user_inputs: {
      currentLocation: inputs.currentLocation || "",
      canDrive: !!inputs.canDrive,
      goal: inputs.goal || "second",
      industry: inputs.industry || "any",
      notes: inputs.notes || "",
    },
    LOCAL_TOWNS: localCorpus,
  });

  return { system: `${system}\n\n${schemaInstr}`, user };
}

export async function askLlm(inputs, settings, locale) {
  const { system, user } = buildLlmPrompt(inputs, locale);
  if (settings.provider === "cloud") {
    const { json } = await askCloudRouter({ system, user, purpose: "long" });
    return json;
  }
  throw new Error("unsupported provider");
}

export function adaptLlmRecommendations(llmJson, locale) {
  const out = [];
  for (const rec of llmJson.recommendations.slice(0, 5)) {
    if (!rec || typeof rec !== "object") continue;
    const recName = String(rec.name || "").trim();
    const recPostcodes = Array.isArray(rec.postcodes)
      ? rec.postcodes.map((p) => Number(p)).filter((n) => Number.isInteger(n))
      : [];
    if (!recName && recPostcodes.length === 0) continue;

    let matched = WHV_TOWNS.find((t) => t.name.toLowerCase() === recName.toLowerCase());
    if (!matched && recPostcodes.length) {
      matched = WHV_TOWNS.find((t) => t.postcodes.some((p) => recPostcodes.includes(p)));
    }

    const town = matched
      ? {
          ...matched,
          postcodes: recPostcodes.length ? recPostcodes : matched.postcodes,
        }
      : {
          id: `llm-${out.length}`,
          name: recName || "Unknown",
          cnName: "",
          state: typeof rec.state === "string" ? rec.state : "",
          postcodes: recPostcodes,
          categories: [],
          industries: [],
          transportFriendly: false,
          climate: "",
          coastal: false,
          backpackerHub: false,
          pros: [],
        };

    const reasons = Array.isArray(rec.reasons)
      ? rec.reasons.filter((r) => typeof r === "string" && r.trim()).slice(0, 4)
      : [];

    void locale;
    out.push({ town, activeTags: ["llm"], llmReasons: reasons });
  }
  return out;
}
