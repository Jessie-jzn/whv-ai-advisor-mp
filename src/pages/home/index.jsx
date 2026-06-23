import { View, Text, Input, Button, ScrollView } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import { useState } from "react";
import PageHeader from "../../components/PageHeader";
import { getPopularTowns, getDisplayName } from "../../utils/townLookup";
import { SUBMISSIONS } from "../../data/submissions";
import { findTownById } from "../../utils/townLookup";
import { calcProgress, migrateWorkRecords } from "../../utils/userStore";
import "./index.scss";

const FEATURES = [
  { key: "calc", icon: "📊", title: "88天\n计算器", tab: "/pages/calculator/index" },
  { key: "ai", icon: "🤖", title: "AI\n集签助手", tab: "/pages/ai/index" },
  { key: "map", icon: "🗺", title: "工作\n地图", tab: "/pages/map/index" },
];

const TOWN_META = {
  bundaberg: { icon: "🍓", score: 98 },
  cairns: { icon: "🌴", score: 92 },
  mildura: { icon: "🍇", score: 96 },
  griffith: { icon: "🍊", score: 94 },
  tully: { icon: "🍌", score: 90 },
  darwin: { icon: "☀️", score: 88 },
};

export default function Home() {
  const [query, setQuery] = useState("");
  const [progress, setProgress] = useState(calcProgress());

  useDidShow(() => {
    migrateWorkRecords();
    setProgress(calcProgress());
  });

  const popular = getPopularTowns(6);

  const goSearch = () => {
    const q = query.trim();
    if (!q) {
      Taro.showToast({ title: "请输入邮编或城镇", icon: "none" });
      return;
    }
    Taro.navigateTo({ url: `/pages/postcode/index?q=${encodeURIComponent(q)}` });
  };

  const goTown = (town) => {
    Taro.navigateTo({
      url: `/pages/postcode/index?q=${encodeURIComponent(town.name)}&id=${town.id}`,
    });
  };

  return (
    <View className="page home">
      <PageHeader title="打工度假助手" />

      <View className="page-body">
        <View className="search-wrap">
          <View className="search-input-wrap">
            <Input
              className="search-input"
              placeholder="输入邮编或城镇，如 4670"
              placeholderClass="search-ph"
              value={query}
              onInput={(e) => setQuery(e.detail.value)}
              confirmType="search"
              onConfirm={goSearch}
            />
          </View>
          <Button className="search-btn" onClick={goSearch}>
            查询
          </Button>
        </View>

        <View className="feature-grid">
          {FEATURES.map((f) => (
            <View
              key={f.key}
              className="feature-tile"
              onClick={() => Taro.switchTab({ url: f.tab })}
            >
              <Text className="feature-icon">{f.icon}</Text>
              <Text className="feature-title">{f.title}</Text>
            </View>
          ))}
        </View>

        <View
          className="card card-green progress-banner"
          onClick={() => Taro.switchTab({ url: "/pages/calculator/index" })}
        >
          <View className="progress-banner-row">
            <Text className="progress-banner-icon">🏅</Text>
            <View className="progress-banner-main">
              <Text className="progress-banner-label">二签 88 天进度</Text>
              <View className="progress-bar">
                <View
                  className="progress-fill"
                  style={{ width: `${progress.percent}%` }}
                />
              </View>
              <Text className="progress-banner-stat">
                有效 {progress.eligibleDays ?? progress.totalDays} / {progress.target} 天 · 还差 {progress.remaining} 天
              </Text>
            </View>
            <Text className="arrow arrow-light">›</Text>
          </View>
        </View>

        <View className="section-head">
          <Text className="section-title">热门集签城镇</Text>
          <Text
            className="section-link"
            onClick={() => Taro.switchTab({ url: "/pages/map/index" })}
          >
            查看地图 →
          </Text>
        </View>

        <ScrollView scrollX className="town-scroll" enableFlex>
          {popular.map((town) => {
            const meta = TOWN_META[town.id] || { icon: "📍", score: 85 };
            return (
              <View key={town.id} className="town-card" onClick={() => goTown(town)}>
                <Text className="town-emoji">{meta.icon}</Text>
                <Text className="town-name font-serif">{town.name}</Text>
                <Text className="town-state">{town.state}</Text>
                <View className="town-badges">
                  <Text className="badge-score">{meta.score}分</Text>
                  <Text className="badge-low">风险低</Text>
                </View>
              </View>
            );
          })}
        </ScrollView>

        <View className="section-head">
          <Text className="section-title">最新用户投稿</Text>
          <Text className="section-meta">实时更新</Text>
        </View>

        {SUBMISSIONS.map((sub) => {
          const town = findTownById(sub.townId);
          return (
            <View key={sub.id} className="card feed-card" onClick={() => town && goTown(town)}>
              <View className="feed-head">
                <View className="feed-avatar">
                  <Text>{sub.author.charAt(0)}</Text>
                </View>
                <View>
                  <Text className="feed-user">
                    {sub.author}
                    {town ? `@${town.state}` : ""}
                  </Text>
                  <Text className="feed-time">{sub.daysAgo * 24} 小时前</Text>
                </View>
              </View>
              <Text className="feed-body">{sub.excerpt}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
