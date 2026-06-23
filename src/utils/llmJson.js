export function parseLlmJson(text) {
  const obj = parseRawLlmJson(text);
  if (!obj || !Array.isArray(obj.recommendations)) {
    throw new Error("missing recommendations array");
  }
  return obj;
}

/** 解析 LLM 返回的 JSON 对象（不校验 schema） */
export function parseRawLlmJson(text) {
  if (typeof text !== "string") throw new Error("empty response");
  let trimmed = text.trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/i);
  if (fence) trimmed = fence[1].trim();
  if (!trimmed.startsWith("{")) {
    const idx = trimmed.indexOf("{");
    if (idx >= 0) trimmed = trimmed.slice(idx);
  }
  return JSON.parse(trimmed);
}
