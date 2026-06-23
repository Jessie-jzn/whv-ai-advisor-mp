import { View, Text, Button } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import { useState } from "react";
import PageHeader from "../../components/PageHeader";
import {
  calcProgress,
  getFavorites,
  getMaterialCount,
  getChecklistProgress,
} from "../../utils/userStore";
import { getAuth, loginWithWechatCode, clearAuth } from "../../utils/auth";
import { SPONSOR_WHV_URL } from "../../utils/config";
import "./index.scss";

const MENU = [
  { key: "materials", icon: "📁", title: "材料中心", desc: "Checklist · 文件上传", url: "/pages/materials/index", tab: false, color: "green" },
  { key: "fav", icon: "♡", title: "我的收藏", desc: "地址与雇主收藏", url: "/pages/map/index", tab: true, color: "amber" },
  { key: "chart", icon: "📈", title: "进度分析", desc: "详细图表", url: "/pages/calculator/index", tab: true, color: "green" },
  { key: "consult", icon: "📞", title: "一对一咨询", desc: "移民顾问在线", url: "guide", tab: false, color: "blue" },
];

export default function Profile() {
  const [auth, setAuth] = useState(() => getAuth());
  const [loggingIn, setLoggingIn] = useState(false);
  const progress = calcProgress();
  const favorites = getFavorites();
  const favEmployerCount = favorites.filter((f) => (f.type || "employer") === "employer").length;
  const favPlaceCount = favorites.filter((f) => f.type === "place").length;
  const materialCount = getMaterialCount();
  const checkProg = getChecklistProgress();
  const isLoggedIn = Boolean(auth?.token && auth?.user);

  useDidShow(() => {
    setAuth(getAuth());
  });

  const onLogin = async () => {
    if (loggingIn) return;
    setLoggingIn(true);
    try {
      const next = await loginWithWechatCode();
      setAuth(next);
      Taro.showToast({ title: "登录成功", icon: "success" });
    } catch (e) {
      Taro.showToast({ title: e?.message || "登录失败", icon: "none" });
    } finally {
      setLoggingIn(false);
    }
  };

  const onLogout = () => {
    clearAuth();
    setAuth(getAuth());
    Taro.showToast({ title: "已退出", icon: "none" });
  };

  const go = (item) => {
    if (item.url === "guide") {
      if (process.env.TARO_ENV === "h5") {
        window.open(SPONSOR_WHV_URL, "_blank");
        return;
      }
      Taro.setClipboardData({
        data: SPONSOR_WHV_URL,
        success: () => Taro.showModal({ title: "咨询入口", content: SPONSOR_WHV_URL, showCancel: false }),
      });
      return;
    }
    if (item.tab) Taro.switchTab({ url: item.url });
    else Taro.navigateTo({ url: item.url });
  };

  return (
    <View className="page profile-page">
      <PageHeader title="我的" />

      <View className="page-body">
        <View className="card profile-card">
          <View className="profile-row">
            <View className="profile-avatar">
              <Text>🧑‍🌾</Text>
            </View>
            <View className="profile-info">
              <Text className="profile-name">
                {isLoggedIn ? `用户 ${auth.user.id || auth.user.userId || ""}` : "WHV 小旅人"}
              </Text>
              <Text className="profile-join">
                {isLoggedIn ? "已登录 · 可同步收藏" : "未登录 · 收藏仅保存在本机"}
              </Text>
            </View>
            <Text className="profile-badge">{isLoggedIn ? "已登录" : "免费版"}</Text>
          </View>
          {!isLoggedIn ? (
            <Button
              className="profile-login-btn"
              loading={loggingIn}
              disabled={loggingIn}
              onClick={onLogin}
            >
              微信登录
            </Button>
          ) : (
            <Button className="profile-logout-btn" onClick={onLogout}>
              退出登录
            </Button>
          )}
        </View>

        <View className="card">
          <Text className="section-title">我的集签进度</Text>
          <View className="profile-stats">
            <View className="profile-stat">
              <Text className="profile-stat-num">{progress.totalDays}天</Text>
              <Text className="profile-stat-lbl">已记录</Text>
            </View>
            <View className="profile-stat">
              <Text className="profile-stat-num">${Math.round(progress.totalIncome)}</Text>
              <Text className="profile-stat-lbl">总收入</Text>
            </View>
            <View className="profile-stat" onClick={() => Taro.navigateTo({ url: "/pages/materials/index" })}>
              <Text className="profile-stat-num">{checkProg.done}/{checkProg.total}</Text>
              <Text className="profile-stat-lbl">材料进度</Text>
            </View>
          </View>
        </View>

        <View className="card menu-card">
          {MENU.map((item) => (
            <View key={item.key} className="menu-item" onClick={() => go(item)}>
              <View className={`menu-icon menu-icon-${item.color}`}>
                <Text>{item.icon}</Text>
              </View>
              <View className="list-item-main">
                <Text className="list-item-title">{item.title}</Text>
                <Text className="list-item-desc">
                  {item.key === "fav"
                    ? `${favPlaceCount} 个地址 · ${favEmployerCount} 个雇主`
                    : item.key === "materials"
                      ? `${materialCount} 份文件 · Checklist ${checkProg.done}/${checkProg.total}`
                      : item.desc}
                </Text>
              </View>
              <Text className="arrow">›</Text>
            </View>
          ))}
        </View>

        <View className="card pro-card">
          <Text className="pro-title">👑 升级到 Pro 会员</Text>
          <Text className="pro-desc">解锁 AI 深度分析、一对一咨询、PDF 报告导出等高级功能</Text>
          <Button className="btn-amber pro-btn" onClick={() => Taro.showToast({ title: "即将上线", icon: "none" })}>
            ¥68/月 · 立即升级
          </Button>
        </View>
      </View>
    </View>
  );
}
