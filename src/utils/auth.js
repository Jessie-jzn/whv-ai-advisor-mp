import Taro from "@tarojs/taro";
import { AUTH_BASE_URL } from "./config";
import { getStorageJson, setStorageJson } from "./storage";

const KEY_AUTH = "whvAuth";

function getAuthBaseUrl() {
  return String(AUTH_BASE_URL || "").replace(/\/$/, "");
}

function assertWeappEnv() {
  if (process.env.TARO_ENV !== "weapp") {
    throw new Error("仅微信小程序支持 wx.login");
  }
}

async function postJson(path, data) {
  const baseUrl = getAuthBaseUrl();
  if (!baseUrl) {
    throw new Error("AUTH_BASE_URL 未配置");
  }
  const res = await Taro.request({
    url: `${baseUrl}${path}`,
    method: "POST",
    timeout: 15000,
    header: {
      "Content-Type": "application/json",
      "X-WHV-Client": "whv-mp",
    },
    data,
  });
  if (!res || res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error("登录失败");
  }
  return typeof res.data === "object" ? res.data : {};
}

export function getAuth() {
  return getStorageJson(KEY_AUTH, { token: "", user: null });
}

export function clearAuth() {
  setStorageJson(KEY_AUTH, { token: "", user: null });
}

export async function loginWithWechatCode() {
  assertWeappEnv();
  const loginRes = await Taro.login();
  const code = loginRes?.code;
  if (!code) {
    throw new Error("微信登录 code 获取失败");
  }
  console.log("微信登录 code 获取", code)

  const data = await postJson("/v1/auth/wechat/login", { code });
  const auth = {
    token: data?.token || "",
    user: data?.user || null,
  };
  if (!auth.token || !auth.user) {
    throw new Error("登录返回数据不完整");
  }
  setStorageJson(KEY_AUTH, auth);
  return auth;
}
