import Taro from "@tarojs/taro";

export function getStorageJson(key, fallback) {
  try {
    const raw = Taro.getStorageSync(key);
    if (raw === "" || raw == null) return fallback;
    if (typeof raw === "object") return raw;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function setStorageJson(key, value) {
  try {
    Taro.setStorageSync(key, value);
  } catch {
    /* swallow */
  }
}
