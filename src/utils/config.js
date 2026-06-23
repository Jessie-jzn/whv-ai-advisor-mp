export const WORKER_BASE_URL = "https://whv-or-proxy.jessie-whv-marker.workers.dev";
export const SPONSOR_WHV_URL = "https://www.jessieontheroad.com/zh/whv/";
export const AUTH_BASE_URL = WORKER_BASE_URL;

/**
 * Worker /v1/ai/chat 的 Origin 白名单匹配值。
 * 小程序默认不带 Origin，可尝试携带；若仍 403 forbidden_origin，
 * 必须在 Cloudflare Worker 对 X-WHV-Client: whv-mp 放行（见 docs/worker-miniprogram-fix.md）
 */
export const WORKER_REQUEST_ORIGIN = "https://www.jessieontheroad.com";
