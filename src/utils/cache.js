import Taro from "@tarojs/taro";
import { getStorageJson, setStorageJson } from "./storage";

const CACHE_STORAGE_KEY = "aiLlmCache";
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 30;

const VALID_PROVIDERS = new Set(["cloud", "local"]);

function normalizeForKey({ inputs, settings, locale }) {
  const i = inputs || {};
  const s = settings || {};
  return {
    v: 1,
    locale: locale === "zh" ? "zh" : "en",
    provider: VALID_PROVIDERS.has(s.provider) ? s.provider : "local",
    model: (s.model || "").trim().toLowerCase(),
    inputs: {
      currentLocation: (i.currentLocation || "").trim().toLowerCase(),
      canDrive: !!i.canDrive,
      goal: (i.goal || "second").trim(),
      industry: (i.industry || "any").trim(),
      notes: (i.notes || "").replace(/\s+/g, " ").trim(),
    },
  };
}

function sha256Hex(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export function buildCacheKey(params) {
  const canonical = JSON.stringify(normalizeForKey(params));
  return Promise.resolve(sha256Hex(canonical));
}

function readBucket() {
  const bucket = getStorageJson(CACHE_STORAGE_KEY, null);
  if (bucket && bucket.entries) return bucket;
  return { entries: {} };
}

function writeBucket(bucket) {
  setStorageJson(CACHE_STORAGE_KEY, bucket);
}

export function getCachedLlm(key, { ttlMs = DEFAULT_TTL_MS } = {}) {
  if (!key) return Promise.resolve(null);
  const bucket = readBucket();
  const entry = bucket.entries[key];
  if (!entry) return Promise.resolve(null);

  const now = Date.now();
  if (typeof entry.ts !== "number" || now - entry.ts > ttlMs) {
    delete bucket.entries[key];
    writeBucket(bucket);
    return Promise.resolve(null);
  }

  entry.lastUsed = now;
  writeBucket(bucket);
  return Promise.resolve({ json: entry.json, cachedAt: entry.ts });
}

export function putCachedLlm(key, json, { maxEntries = MAX_ENTRIES } = {}) {
  if (!key) return Promise.resolve();
  if (!json || !Array.isArray(json.recommendations) || json.recommendations.length === 0) {
    return Promise.resolve();
  }
  const bucket = readBucket();
  const now = Date.now();
  bucket.entries[key] = { json, ts: now, lastUsed: now };

  const keys = Object.keys(bucket.entries);
  if (keys.length > maxEntries) {
    const sorted = keys
      .map((k) => ({ k, lu: bucket.entries[k].lastUsed || bucket.entries[k].ts || 0 }))
      .sort((a, b) => a.lu - b.lu);
    const toDrop = sorted.slice(0, keys.length - maxEntries);
    for (const { k } of toDrop) delete bucket.entries[k];
  }
  writeBucket(bucket);
  return Promise.resolve();
}

export function clearLlmCache() {
  writeBucket({ entries: {} });
  return Promise.resolve();
}

export function getLlmCacheStats() {
  const bucket = readBucket();
  const entries = Object.values(bucket.entries);
  if (!entries.length) return Promise.resolve({ count: 0, oldestAt: 0, newestAt: 0 });
  let oldestAt = Infinity;
  let newestAt = 0;
  for (const e of entries) {
    if (typeof e.ts === "number") {
      if (e.ts < oldestAt) oldestAt = e.ts;
      if (e.ts > newestAt) newestAt = e.ts;
    }
  }
  return Promise.resolve({
    count: entries.length,
    oldestAt: oldestAt === Infinity ? 0 : oldestAt,
    newestAt,
  });
}
