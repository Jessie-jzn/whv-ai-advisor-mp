import { View, Text, Input, Button } from "@tarojs/components";
import Taro, { useRouter } from "@tarojs/taro";
import { useState, useEffect, useRef } from "react";
import {
  getDisplayName,
  getRegionTypes,
  getApplicableVisas,
  getCommonJobs,
  getRiskTips,
  getTownSummary,
  getTownAreas,
} from "../../utils/townLookup";
import { AREA_LABELS, INDUSTRY_LABELS } from "../../utils/eligibility";
import { hasCloudRouter } from "../../utils/cloudRouter";
import {
  resolvePostcodeSearch,
  enrichPostcodeWithAi,
  getSourceLabel,
} from "../../utils/postcodeAi";
import { getFavorites, isFavorite, toggleFavorite } from "../../utils/userStore";
import "./index.scss";

function SourceBadge({ source }) {
  const cls =
    source === "merged"
      ? "src-merged"
      : source === "ai"
        ? "src-ai"
        : "src-db";
  return <Text className={`source-badge ${cls}`}>{getSourceLabel(source)}</Text>;
}

function EligibilityBlock({ eligibility, loading }) {
  if (!eligibility) return null;
  if (!eligibility.found) {
    if (loading) return null;
    return (
      <View className="block">
        <Text className="section-title">官方指定工作资格</Text>
        <Text className="empty-hint">未命中 Home Affairs eligible 邮编列表</Text>
      </View>
    );
  }
  return (
    <View className="block">
      <Text className="section-title">官方指定工作资格</Text>
      <View className="tags">
        {eligibility.areas.map((a) => (
          <Text key={a} className="tag tag-green">
            {AREA_LABELS[a] || a}
          </Text>
        ))}
      </View>
      <Text className="block-sub">可计入行业</Text>
      <View className="tags">
        {eligibility.industries.map((ind) => (
          <Text key={ind} className="tag tag-muted">
            {INDUSTRY_LABELS[ind] || ind}
          </Text>
        ))}
      </View>
      {eligibility.tourismSpecial && (
        <Text className="bullet">Table 2 旅游餐饮特殊邮编</Text>
      )}
    </View>
  );
}

function TownResultCard({ item, onCopy, onToggleFav, favorite }) {
  const { town, source, aiLocality } = item;
  return (
    <View className="card result-block town-result">
      <View className="result-head">
        <View className="result-head-main">
          <Text className="result-name">{getDisplayName(town)}</Text>
          <SourceBadge source={source} />
        </View>
        <View className="result-head-actions">
          <Text className="state-badge">{town.state}</Text>
          <Text className={`fav-heart ${favorite ? "fav-heart-on" : ""}`} onClick={() => onToggleFav(item)}>
            {favorite ? "♥" : "♡"}
          </Text>
        </View>
      </View>

      {aiLocality?.type && (
        <Text className="result-summary">
          AI 识别 · {aiLocality.type === "suburb" ? "郊区" : aiLocality.type}
          {aiLocality.isPrimary ? " · 主归属地" : ""}
        </Text>
      )}
      {!aiLocality && <Text className="result-summary">{getTownSummary(town)}</Text>}

      {town._aiGenerated && (
        <Text className="ai-hint">该地名由 AI 识别，知识库暂无详细条目，以下资格来自官方邮编索引</Text>
      )}

      <View className="block">
        <Text className="section-title">邮编</Text>
        <View className="postcode-row">
          <Text className="postcode-value">{(town.postcodes || []).join(", ") || "—"}</Text>
          {(town.postcodes || []).length > 0 && (
            <Button className="copy-pc-btn" size="mini" onClick={() => onCopy(town)}>
              复制
            </Button>
          )}
        </View>
      </View>

      <View className="block">
        <Text className="section-title">区域类型</Text>
        <View className="tags">
          {getRegionTypes(town).map((t) => (
            <Text key={t} className="tag tag-green">
              {t}
            </Text>
          ))}
          {!getTownAreas(town).length && (
            <Text className="tag tag-amber">未命中</Text>
          )}
        </View>
      </View>

      <View className="block">
        <Text className="section-title">适用签证</Text>
        {getApplicableVisas(town).map((v) => (
          <Text key={v} className="bullet">
            {v}
          </Text>
        ))}
      </View>

      <View className="block">
        <Text className="section-title">可计入行业</Text>
        <View className="tags">
          {getCommonJobs(town).map((j) => (
            <Text key={j} className="tag tag-muted">
              {j}
            </Text>
          ))}
        </View>
      </View>

      {!town._aiGenerated && (
        <View className="block">
          <Text className="section-title">风险提示</Text>
          {getRiskTips(town).map((tip) => (
            <Text key={tip} className="bullet risk">
              {tip}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

export default function Postcode() {
  const router = useRouter();
  const initialQ = decodeURIComponent(router.params.q || "");
  const initialId = router.params.id || "";

  const [query, setQuery] = useState(initialQ);
  const [result, setResult] = useState(null);
  const [searched, setSearched] = useState(!!initialQ || !!initialId);
  const [favoriteIds, setFavoriteIds] = useState(
    getFavorites()
      .filter((f) => f.type === "place")
      .map((f) => f.id)
  );
  const reqId = useRef(0);

  const runSearch = (q, townId) => {
    const base = resolvePostcodeSearch(q, { townId });
    setResult({ ...base, aiLoading: base.isPostcodeQuery && hasCloudRouter() });

    if (!base.isPostcodeQuery || !hasCloudRouter()) return;

    const id = ++reqId.current;
    enrichPostcodeWithAi(base).then((enriched) => {
      if (reqId.current !== id) return;
      setResult(enriched);
    });
  };

  useEffect(() => {
    if (searched && (initialQ || initialId)) {
      runSearch(initialQ || query, initialId || undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doSearch = () => {
    if (!query.trim()) {
      Taro.showToast({ title: "请输入查询内容", icon: "none" });
      return;
    }
    setSearched(true);
    runSearch(query.trim());
  };

  const copyPostcodes = (town) => {
    Taro.setClipboardData({
      data: (town.postcodes || []).join(", "),
      success: () => Taro.showToast({ title: "已复制邮编", icon: "success" }),
    });
  };

  const togglePlaceFavorite = (item) => {
    const { town, source } = item;
    const favItem = {
      id: town.id,
      type: "place",
      name: getDisplayName(town),
      state: town.state || "",
      postcode: (town.postcodes || [])[0] ? String((town.postcodes || [])[0]).padStart(4, "0") : "",
      townId: town.id,
      query: town.name,
      source,
    };
    const was = isFavorite(town.id, "place");
    toggleFavorite(favItem);
    setFavoriteIds(
      getFavorites()
        .filter((f) => f.type === "place")
        .map((f) => f.id)
    );
    Taro.showToast({ title: was ? "已取消收藏" : "已收藏地址", icon: "none" });
  };

  const showEmpty =
    searched &&
    result &&
    result.items.length === 0 &&
    !result.eligibility?.found &&
    !result.aiLoading;

  return (
    <View className="page">
      <View className="page-body">
        <View className="search-wrap">
          <View className="search-input-wrap">
            <Input
              className="search-input"
              placeholder="邮编、英文名或中文名"
              placeholderClass="search-ph"
              value={query}
              onInput={(e) => setQuery(e.detail.value)}
              confirmType="search"
              onConfirm={doSearch}
            />
          </View>
          <Button className="search-btn" onClick={doSearch}>
            查询
          </Button>
        </View>

        {result?.isPostcodeQuery && (
          <View className="card result-block postcode-hero">
            <View className="result-head">
              <Text className="result-name font-serif">邮编 {result.postcode}</Text>
              <Text className="state-badge">{result.eligibility?.state || "?"}</Text>
            </View>

            {result.aiLoading && (
              <View className="ai-loading">
                <Text className="ai-loading-text">🤖 AI 正在识别归属城镇…</Text>
              </View>
            )}

            {result.ai?.summary && (
              <View className="ai-summary-block">
                <Text className="ai-summary-label">AI 解读</Text>
                <Text className="ai-summary-text">{result.ai.summary}</Text>
                {result.ai.whvNote ? (
                  <Text className="ai-whv-note">{result.ai.whvNote}</Text>
                ) : null}
                {result.ai.cached && (
                  <Text className="ai-cache-hint">已缓存 · 7 天内有效</Text>
                )}
              </View>
            )}

            {result.aiError && !result.ai && (
              <View className="ai-error-block">
                <Text className="ai-error">AI 识别失败</Text>
              </View>
            )}

            <EligibilityBlock eligibility={result.eligibility} loading={result.aiLoading} />
          </View>
        )}

        {result?.items.map((item) => (
          <TownResultCard
            key={item.key}
            item={item}
            onCopy={copyPostcodes}
            onToggleFav={togglePlaceFavorite}
            favorite={favoriteIds.includes(item.town.id)}
          />
        ))}

        {showEmpty && (
          <View className="card">
            <Text className="empty-hint">未找到匹配城镇或邮编</Text>
          </View>
        )}

        {!result?.isPostcodeQuery && searched && result?.items.length === 0 && (
          <View className="card">
            <Text className="empty-hint">未找到匹配城镇</Text>
          </View>
        )}
      </View>
    </View>
  );
}
