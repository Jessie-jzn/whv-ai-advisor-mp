import { useRef, useState, useMemo } from "react";
import { View, Text, Button } from "@tarojs/components";
import Taro from "@tarojs/taro";
import PageHeader from "../../components/PageHeader";
import { recommendWhvTowns, pickRelevantPros } from "../../utils/recommend";
import { askLlm, adaptLlmRecommendations } from "../../utils/llm";
import { hasCloudRouter } from "../../utils/cloudRouter";
import { buildCacheKey, getCachedLlm, putCachedLlm } from "../../utils/cache";
import { getDisplayTownName } from "../../utils/i18n";
import { getRiskTips, INDUSTRY_LABELS, getDisplayName } from "../../utils/townLookup";
import { getStorageJson, setStorageJson } from "../../utils/storage";
import "./index.scss";

const STORAGE_INPUTS = "aiAdvisorInputs";

const VISA_OPTS = [
  { id: "second", label: "二签" },
  { id: "work", label: "一签" },
  { id: "third", label: "三签" },
];

const EXP_OPTS = [
  { id: "none", label: "无经验" },
  { id: "farm", label: "有农场经验" },
  { id: "other", label: "其他体力工" },
];

const REGION_OPTS = [
  { id: "any", label: "不限" },
  { id: "coastal", label: "偏爱沿海" },
  { id: "inland", label: "偏爱内陆" },
  { id: "tropical", label: "偏爱热带" },
];

const TIME_OPTS = [
  { id: "1-2", label: "1-2 个月" },
  { id: "3", label: "3 个月" },
  { id: "3+", label: "3 个月以上" },
];

function ChipGroup({ label, options, value, onChange }) {
  return (
    <View className="chip-group">
      <Text className="label">{label}</Text>
      <View className="chip-row">
        {options.map((o) => (
          <Text
            key={o.id}
            className={`chip ${value === o.id ? "chip-active" : ""}`}
            onClick={() => onChange(o.id)}
          >
            {o.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

export default function AiPage() {
  const [visa, setVisa] = useState("second");
  const [exp, setExp] = useState("none");
  const [region, setRegion] = useState("any");
  const [time, setTime] = useState("3");
  const [loading, setLoading] = useState(false);
  const [asked, setAsked] = useState(false);
  const [results, setResults] = useState([]);
  const [summary, setSummary] = useState("");

  const lastRawRecs = useRef(null);

  const buildInputs = () => {
    const notes = [
      exp === "farm" ? "有农场经验" : exp === "other" ? "有其他体力工作经验" : "",
      region === "coastal" ? "偏爱沿海" : region === "inland" ? "偏爱内陆" : region === "tropical" ? "想暖和热带" : "",
      time === "1-2" ? "只有1-2个月" : time === "3" ? "可用3个月" : "可用3个月以上",
    ]
      .filter(Boolean)
      .join("，");

    return {
      currentLocation: "",
      goal: visa,
      industry: exp === "farm" ? "farm" : exp === "other" ? "construction" : "any",
      canDrive: false,
      notes,
    };
  };

  const jobTypes = useMemo(() => {
    if (!lastRawRecs.current?.length) return [];
    const set = new Set();
    lastRawRecs.current.forEach(({ town }) => {
      (town.industries || []).forEach((i) => set.add(INDUSTRY_LABELS[i] || i));
    });
    return [...set].slice(0, 6);
  }, [results, asked]);

  const riskItems = useMemo(() => {
    if (!lastRawRecs.current?.length) return [];
    const tips = [];
    lastRawRecs.current.slice(0, 2).forEach(({ town }) => {
      getRiskTips(town).slice(0, 2).forEach((t, i) => {
        tips.push({ level: i === 1 ? "中" : "低", text: t.replace(/^⚠️\s*/, "") });
      });
    });
    return tips.slice(0, 3);
  }, [results, asked]);

  const handleGenerate = async () => {
    const inputs = buildInputs();
    setStorageJson(STORAGE_INPUTS, inputs);
    setLoading(true);
    setAsked(true);

    const renderLocal = () => {
      const recs = recommendWhvTowns(inputs);
      lastRawRecs.current = recs;
      setResults(
        recs.map((item, i) => ({
          id: item.town.id,
          displayName: getDisplayTownName(item.town, "zh"),
          match: 96 - i * 8,
          reasons: pickRelevantPros(item.town, item.activeTags, "zh", 2),
        }))
      );
      setSummary("基于你的情况，以下是专属集签路线建议");
    };

    try {
      if (hasCloudRouter()) {
        try {
          Taro.showLoading({ title: "AI 生成中…", mask: true });
          const settings = { provider: "cloud" };
          const cacheKey = await buildCacheKey({ inputs, settings, locale: "zh" });
          const cached = await getCachedLlm(cacheKey);
          let llmJson;
          if (cached) {
            llmJson = cached.json;
          } else {
            llmJson = await askLlm(inputs, settings, "zh");
            await putCachedLlm(cacheKey, llmJson);
          }
          const recs = adaptLlmRecommendations(llmJson, "zh");
          if (recs.length) {
            lastRawRecs.current = recs;
            setSummary(llmJson.summary || "AI 方案生成完毕");
            setResults(
              recs.map((item, i) => ({
                id: item.town.id || `r-${i}`,
                displayName: getDisplayTownName(item.town, "zh"),
                match: 96 - i * 8,
                reasons: item.llmReasons?.length ? item.llmReasons.slice(0, 2) : pickRelevantPros(item.town, item.activeTags, "zh", 2),
              }))
            );
            return;
          }
        } catch {
          /* fallback local */
        } finally {
          Taro.hideLoading();
        }
      }
      renderLocal();
    } finally {
      setLoading(false);
    }
  };

  const visaLabel = VISA_OPTS.find((v) => v.id === visa)?.label || "二签";
  const expLabel = EXP_OPTS.find((e) => e.id === exp)?.label || "无经验";
  const timeLabel = TIME_OPTS.find((t) => t.id === time)?.label || "3 个月";

  return (
    <View className="page ai-page">
      <PageHeader title="AI 集签助手" />

      <View className="page-body">
        {!asked ? (
          <>
            <View className="card intro-card">
              <Text className="intro-icon">✨</Text>
              <View>
                <Text className="intro-title">AI 集签助手</Text>
                <Text className="intro-desc">告诉我你的情况，帮你制定最优集签计划</Text>
              </View>
            </View>

            <View className="card">
              <ChipGroup label="当前持有签证" options={VISA_OPTS} value={visa} onChange={setVisa} />
              <ChipGroup label="工作经验" options={EXP_OPTS} value={exp} onChange={setExp} />
              <ChipGroup label="偏好地区" options={REGION_OPTS} value={region} onChange={setRegion} />
              <ChipGroup label="可用时间" options={TIME_OPTS} value={time} onChange={setTime} />
            </View>

            <Button className="btn-amber gen-btn" loading={loading} onClick={handleGenerate}>
              ⚡ 生成我的集签方案
            </Button>
          </>
        ) : (
          <>
            <View className="card card-green ai-done-banner">
              <Text className="ai-done-icon">✨</Text>
              <View>
                <Text className="ai-done-title">AI 方案生成完毕</Text>
                <Text className="ai-done-desc">
                  基于你的情况（{visaLabel} · {expLabel} · {timeLabel}），以下是专属集签路线：
                </Text>
              </View>
            </View>

            <View className="card">
              <Text className="section-title">📍 推荐城镇（按匹配度排序）</Text>
              {results.map((item) => (
                <View key={item.id} className="match-row">
                  <Text className="match-pct">{item.match}%</Text>
                  <View className="match-body">
                    <Text className="match-name font-serif">{item.displayName}</Text>
                    {item.reasons.map((r) => (
                      <Text key={r} className="match-reason">{r}</Text>
                    ))}
                  </View>
                </View>
              ))}
            </View>

            {jobTypes.length > 0 && (
              <View className="card">
                <Text className="section-title">💼 推荐工作类型</Text>
                <View className="chip-row">
                  {jobTypes.map((j) => (
                    <Text key={j} className="tag tag-green">{j}</Text>
                  ))}
                </View>
                <Text className="hint">以上工种均在 ANZSCO 认可范围内，可计入 88 天</Text>
              </View>
            )}

            {riskItems.length > 0 && (
              <View className="card card-amber">
                <Text className="section-title">🛡 风险分析</Text>
                {riskItems.map((r) => (
                  <View key={r.text} className="risk-row">
                    <Text className={`risk-badge ${r.level === "中" ? "risk-mid" : "risk-low"}`}>
                      {r.level}
                    </Text>
                    <Text className="risk-text">{r.text}</Text>
                  </View>
                ))}
              </View>
            )}

            <Button className="btn-ghost" onClick={() => setAsked(false)}>
              重新填写
            </Button>
          </>
        )}
      </View>
    </View>
  );
}
