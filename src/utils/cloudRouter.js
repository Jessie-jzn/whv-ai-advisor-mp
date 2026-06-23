import Taro from "@tarojs/taro";
import { WORKER_BASE_URL, WORKER_REQUEST_ORIGIN } from "./config";
import { parseLlmJson } from "./llmJson";

export function hasCloudRouter() {
  return typeof WORKER_BASE_URL === "string" && /^https?:\/\//.test(WORKER_BASE_URL);
}

function getClientHeader() {
  return process.env.TARO_ENV === "h5" ? "whv-web" : "whv-mp";
}

function buildRequestHeaders() {
  const headers = {
    "Content-Type": "application/json",
    "X-WHV-Client": getClientHeader(),
  };

  // 小程序 POST 不带 Origin → Worker 返回 403 forbidden_origin
  // 尝试携带白名单 Origin（部分基础库允许自定义 Origin）
  const origin =
    process.env.TARO_ENV === "h5" && typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : WORKER_REQUEST_ORIGIN;

  if (origin) {
    headers.Origin = origin;
  }

  return headers;
}

function normalizePurpose(purpose) {
  const valid = new Set(["long", "fast", "code", "default"]);
  if (valid.has(purpose)) return purpose;
  if (purpose === "short") return "fast";
  return "default";
}

function mapHttpError(statusCode, errText) {
  if (statusCode === 403 && /forbidden_origin/i.test(errText)) {
    return (
      "Worker 拒绝请求（forbidden_origin）：请在 Worker 支持 ?client=whv-mp，" +
      "详见 docs/worker-miniprogram-fix.md"
    );
  }
  if (/all_providers_failed/i.test(errText)) {
    let hint = "Worker 可达，但所有 AI 上游均失败（通常是 API Key 无效或未配置）。";
    try {
      const obj = JSON.parse(errText.replace(/^CloudRouter \d+ /, "").trim());
      const attempts = obj.attempts || [];
      const bad = attempts.find((a) => a.status === 401 || /invalid.*key/i.test(a.error || ""));
      if (bad) {
        hint += ` ${bad.provider} 报 Key 无效，请在 Worker 项目执行 wrangler secret put 更新密钥。`;
      }
    } catch (_e) {
      /* ignore */
    }
    return hint;
  }
  return `CloudRouter ${statusCode} ${errText.slice(0, 280)}`;
}

function mapRequestError(err) {
  const msg = String(err?.errMsg || err?.message || err || "");
  if (/forbidden_origin/i.test(msg)) {
    return mapHttpError(403, msg);
  }
  if (/domain list|合法域名|url not in|不在以下 request|not in domain/i.test(msg)) {
    return "request 合法域名未配置或未生效（需配置微信小程序，不是公众号）";
  }
  if (/timeout|timed out|超时/i.test(msg)) {
    return "请求超时：AI 响应过慢或网络不稳定，请稍后重试";
  }
  if (/ssl|certificate|证书/i.test(msg)) {
    return "HTTPS 证书校验失败";
  }
  if (/fail|connect|network|网络/i.test(msg)) {
    return `网络请求失败：${msg.slice(0, 120)}`;
  }
  return msg || "未知网络错误";
}

async function requestJson(url, data, { method = "POST", timeout = 58000 } = {}) {
  let res;
  try {
    res = await Taro.request({
      url,
      method,
      timeout,
      header: buildRequestHeaders(),
      data: method === "POST" ? data : undefined,
    });
  } catch (err) {
    throw new Error(mapRequestError(err));
  }

  if (!res || res.statusCode === 0) {
    throw new Error("网络无响应，请检查域名白名单与网络连接");
  }

  const errText =
    typeof res.data === "string" ? res.data : JSON.stringify(res.data || {});
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(mapHttpError(res.statusCode, errText));
  }

  return res;
}

/** 探测 Worker 是否可达（不调用 AI，用于排查域名问题） */
export async function pingCloudRouter() {
  if (!hasCloudRouter()) return { ok: false, error: "未配置 WORKER_BASE_URL" };
  try {
    const url = `${WORKER_BASE_URL.replace(/\/$/, "")}/`;
    const res = await requestJson(url, null, { method: "GET", timeout: 12000 });
    const data = typeof res.data === "object" ? res.data : {};
    return { ok: true, service: data.service || "unknown" };
  } catch (e) {
    return { ok: false, error: e?.message || "ping failed" };
  }
}

export async function askCloudRouter({ system, user, purpose = "long", parseFn }) {
  if (!hasCloudRouter()) {
    throw new Error("Cloud AI router URL not configured");
  }
  const client = getClientHeader();
  // 微信小程序可能丢弃自定义 Header，用 query + body 双保险
  const url = `${WORKER_BASE_URL.replace(/\/$/, "")}/v1/ai/chat?client=${encodeURIComponent(client)}`;
  const res = await requestJson(url, {
    _whv_client: client,
    purpose: normalizePurpose(purpose),
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.4,
    response_format: { type: "json_object" },
  });

  const data = typeof res.data === "object" ? res.data : JSON.parse(String(res.data));
  const header = res.header || {};
  const provider =
    header["X-WHV-Provider"] || header["x-whv-provider"] || data?._whv_router?.provider || "cloud";
  const model = header["X-WHV-Model"] || header["x-whv-model"] || data?._whv_router?.model || "";
  const content = data?.choices?.[0]?.message?.content;
  const parser = parseFn || parseLlmJson;
  const json = parser(content);
  return { json, provider, model };
}
