import { View, Text, Map, ScrollView } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useMemo, useState } from "react";
import PageHeader from "../../components/PageHeader";
import {
  MOCK_EMPLOYERS,
  getFavorites,
  toggleFavorite,
  isFavorite,
  getWorkRecords,
  migrateWorkRecords,
} from "../../utils/userStore";
import {
  findTownById,
  getDisplayName,
  getTownAreas,
} from "../../utils/townLookup";
import {
  INDUSTRY_LABELS,
  AREA_LABELS,
  checkEligibility,
  normalizeIndustry,
} from "../../utils/eligibility";
import { WHV_TOWNS } from "../../data/whvTowns";
import "./index.scss";

const STATE_FILTERS = ["全部", "QLD", "VIC", "NSW", "WA", "NT", "SA", "TAS"];
const AREA_FILTERS = [
  { id: "all", label: "全部区域" },
  { id: "regional", label: "Regional" },
  { id: "northern", label: "Northern" },
  { id: "remote", label: "Remote" },
  { id: "bushfire", label: "山火" },
  { id: "natural", label: "灾害" },
];

const HOURLY = {
  plant_animal: 26,
  tourism_hospitality: 28,
  construction: 32,
  farm: 26,
  hospitality: 28,
  default: 25,
};

const TOWN_COORDS = {
  bundaberg: { lat: -24.86, lng: 152.35 },
  cairns: { lat: -16.92, lng: 145.77 },
  tully: { lat: -17.93, lng: 145.92 },
  katherine: { lat: -14.46, lng: 132.26 },
  mildura: { lat: -34.19, lng: 142.16 },
  darwin: { lat: -12.46, lng: 130.84 },
  griffith: { lat: -34.29, lng: 146.04 },
  innisfail: { lat: -17.52, lng: 146.03 },
};

export default function MapPage() {
  const [filter, setFilter] = useState("全部");
  const [areaFilter, setAreaFilter] = useState("all");
  const [showWork, setShowWork] = useState(false);
  const [selected, setSelected] = useState(null);
  const [favKeys, setFavKeys] = useState(
    getFavorites().map((f) => `${f.type || "employer"}:${f.id}`)
  );

  const workRecords = useMemo(() => {
    migrateWorkRecords();
    return getWorkRecords().filter((r) => r.postcode || r.location);
  }, [showWork]);

  const townMarkers = useMemo(() => {
    return WHV_TOWNS.filter((t) => t.backpackerHub && getTownAreas(t).length > 0)
      .filter((t) => filter === "全部" || t.state === filter)
      .filter((t) => {
        if (areaFilter === "all") return true;
        return getTownAreas(t).includes(areaFilter);
      })
      .map((town, i) => {
        const coords = TOWN_COORDS[town.id];
        if (!coords) return null;
        const areas = getTownAreas(town);
        return {
          id: 1000 + i,
          type: "town",
          town,
          latitude: coords.lat,
          longitude: coords.lng,
          title: town.name,
          width: 24,
          height: 24,
          areas,
        };
      })
      .filter(Boolean);
  }, [filter, areaFilter]);

  const employers = useMemo(() => {
    let list = MOCK_EMPLOYERS;
    if (filter !== "全部") {
      list = list.filter((e) => {
        const town = findTownById(e.townId);
        return town?.state === filter;
      });
    }
    if (areaFilter !== "all") {
      list = list.filter((e) => {
        const check = checkEligibility(e.postcode, e.industry);
        return check.areas?.includes(areaFilter);
      });
    }
    return list;
  }, [filter, areaFilter]);

  const empMarkers = employers.map((e, i) => ({
    id: i,
    type: "employer",
    emp: e,
    latitude: e.lat,
    longitude: e.lng,
    title: e.name,
    width: 28,
    height: 28,
  }));

  const workMarkers = showWork
    ? workRecords
        .map((r, i) => {
          const town = WHV_TOWNS.find((t) =>
            t.postcodes?.some((p) => String(p).padStart(4, "0") === String(r.postcode).padStart(4, "0"))
          );
          const coords = town ? TOWN_COORDS[town.id] : null;
          if (!coords) return null;
          return {
            id: 2000 + i,
            type: "work",
            record: r,
            latitude: coords.lat + (i % 3) * 0.05,
            longitude: coords.lng + (i % 2) * 0.05,
            title: r.employer,
            width: 22,
            height: 22,
          };
        })
        .filter(Boolean)
    : [];

  const markers = [...townMarkers, ...empMarkers, ...workMarkers];

  const center = selected?.lat
    ? { latitude: selected.lat, longitude: selected.lng }
    : { latitude: -22, longitude: 145 };

  const onToggleFav = (emp) => {
    const was = isFavorite(emp.id, "employer");
    const town = findTownById(emp.townId);
    toggleFavorite({ id: emp.id, type: "employer", name: emp.name, town: town ? getDisplayName(town) : "" });
    setFavKeys(getFavorites().map((f) => `${f.type || "employer"}:${f.id}`));
    Taro.showToast({ title: was ? "已取消" : "已收藏", icon: "none" });
  };

  const favoritePlaces = useMemo(
    () =>
      getFavorites()
        .filter((f) => f.type === "place")
        .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0)),
    [favKeys]
  );

  const onMarkerTap = (e) => {
    const m = markers.find((mk) => mk.id === e.detail.markerId);
    if (m?.type === "employer") setSelected(m.emp);
    if (m?.type === "town") {
      Taro.navigateTo({
        url: `/pages/postcode/index?q=${encodeURIComponent(m.town.name)}&id=${m.town.id}`,
      });
    }
  };

  return (
    <View className="page map-page">
      <PageHeader title="集签地图" />

      <View className="page-body">
        <ScrollView scrollX className="filter-scroll" enableFlex>
          {STATE_FILTERS.map((s) => (
            <Text
              key={s}
              className={`pill-tab ${filter === s ? "pill-tab-active" : ""}`}
              onClick={() => setFilter(s)}
            >
              {s}
            </Text>
          ))}
        </ScrollView>

        <ScrollView scrollX className="filter-scroll area-scroll" enableFlex>
          {AREA_FILTERS.map((a) => (
            <Text
              key={a.id}
              className={`pill-tab pill-tab-sm ${areaFilter === a.id ? "pill-tab-active" : ""}`}
              onClick={() => setAreaFilter(a.id)}
            >
              {a.label}
            </Text>
          ))}
          <Text
            className={`pill-tab pill-tab-sm ${showWork ? "pill-tab-active" : ""}`}
            onClick={() => setShowWork(!showWork)}
          >
            我的工作 {workRecords.length > 0 ? `(${workRecords.length})` : ""}
          </Text>
        </ScrollView>

        <View className="map-legend">
          {["regional", "northern", "remote", "bushfire", "natural"].map((a) => (
            <Text key={a} className={`legend-item legend-${a}`}>
              {AREA_LABELS[a]?.split(" ")[0] || a}
            </Text>
          ))}
        </View>

        <View className="card map-card">
          <Map
            className="map"
            latitude={center.latitude}
            longitude={center.longitude}
            scale={5}
            markers={markers}
            onMarkerTap={onMarkerTap}
          />
          <Text className="map-hint">
            {townMarkers.length} 个集签城镇 · {employers.length} 个雇主
            {showWork ? ` · ${workMarkers.length} 条工作记录` : ""}
          </Text>
        </View>

        <View className="card">
          <Text className="section-title">我的收藏</Text>
          <Text className="list-count">
            地址 {favoritePlaces.length} · 雇主 {favKeys.filter((k) => k.startsWith("employer:")).length}
          </Text>
          {favoritePlaces.length === 0 ? (
            <Text className="empty-hint">还没有收藏地址，去邮编查询页点 ♥ 收藏</Text>
          ) : (
            favoritePlaces.map((place) => (
              <View
                key={`place-${place.id}`}
                className="fav-place-row"
                onClick={() =>
                  Taro.navigateTo({
                    url: `/pages/postcode/index?q=${encodeURIComponent(
                      place.postcode || place.query || place.name || ""
                    )}&id=${place.townId || place.id}`,
                  })
                }
              >
                <View className="list-item-main">
                  <Text className="list-item-title">{place.name}</Text>
                  <Text className="list-item-desc">
                    {place.state || "未知州"}{place.postcode ? ` · ${place.postcode}` : ""}
                  </Text>
                </View>
                <Text
                  className="emp-heart emp-heart-on"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    toggleFavorite(place);
                    setFavKeys(getFavorites().map((f) => `${f.type || "employer"}:${f.id}`));
                    Taro.showToast({ title: "已取消", icon: "none" });
                  }}
                >
                  ♥
                </Text>
              </View>
            ))
          )}
        </View>

        {employers.map((emp) => {
          const town = findTownById(emp.townId);
          const ind = normalizeIndustry(emp.industry);
          const rate = HOURLY[ind] || HOURLY.default;
          const check = checkEligibility(emp.postcode, ind);
          const fav = favKeys.includes(`employer:${emp.id}`);
          return (
            <View
              key={emp.id}
              className="card emp-card"
              onClick={() => setSelected(emp)}
            >
              <View className="emp-card-top">
                <View>
                  <Text className="emp-name font-serif">{emp.name}</Text>
                  <Text className="emp-loc">
                    {town ? `${town.name} ${town.state}` : ""} · {emp.postcode}
                  </Text>
                </View>
                <Text
                  className={`emp-heart ${fav ? "emp-heart-on" : ""}`}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onToggleFav(emp);
                  }}
                >
                  {fav ? "♥" : "♡"}
                </Text>
              </View>
              <View className="emp-tags">
                {(check.areas || []).slice(0, 3).map((a) => (
                  <Text key={a} className={`tag tag-area tag-${a}`}>
                    {AREA_LABELS[a]?.split(" ")[0] || a}
                  </Text>
                ))}
                <Text className="tag tag-muted">{INDUSTRY_LABELS[ind] || ind}</Text>
              </View>
              <View className="emp-card-bottom">
                <Text className="emp-rate">${rate}/hr</Text>
                <Text className="emp-rating">★ {emp.rating} · {emp.reviews} 评价</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
