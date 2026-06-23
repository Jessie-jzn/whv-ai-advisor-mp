import { getStorageJson, setStorageJson } from "./storage";
import {
  enrichWorkRecord,
  calcWorkProgress,
  TARGET_DAYS_SECOND,
  TARGET_DAYS_THIRD,
} from "./eligibility";

const KEY_WORK = "whvWorkRecords";
const KEY_FAV = "whvFavorites";
const KEY_MATERIALS = "whvMaterials";
const KEY_VISA_GOAL = "whvVisaGoal";

export { TARGET_DAYS_SECOND as TARGET_DAYS, TARGET_DAYS_SECOND, TARGET_DAYS_THIRD };

export function getVisaGoal() {
  return getStorageJson(KEY_VISA_GOAL, "second");
}

export function setVisaGoal(goal) {
  setStorageJson(KEY_VISA_GOAL, goal === "third" ? "third" : "second");
}

export function getTargetDays(goal = getVisaGoal()) {
  return goal === "third" ? TARGET_DAYS_THIRD : TARGET_DAYS_SECOND;
}

export function getWorkRecords() {
  return getStorageJson(KEY_WORK, []);
}

export function saveWorkRecords(records) {
  setStorageJson(KEY_WORK, records);
}

export function addWorkRecord(record) {
  const enriched = enrichWorkRecord({
    employmentType: "paid",
    weeklyDays: 5,
    payType: "hourly",
    visaAtWork: "462_first",
    ...record,
  });
  const records = getWorkRecords();
  const next = [
    {
      id: `w-${Date.now()}`,
      createdAt: Date.now(),
      ...enriched,
    },
    ...records,
  ];
  saveWorkRecords(next);
  return next;
}

export function removeWorkRecord(id) {
  const next = getWorkRecords().filter((r) => r.id !== id);
  saveWorkRecords(next);
  return next;
}

export function calcProgress(records = getWorkRecords(), goal = getVisaGoal()) {
  const target = getTargetDays(goal);
  const progress = calcWorkProgress(records, target);
  return {
    ...progress,
    goal,
    target,
    remaining: progress.remaining,
    percent: progress.percent,
  };
}

export function migrateWorkRecords() {
  const records = getWorkRecords();
  const needsMigration = records.some(
    (r) => r.eligible == null || r.industry === "farm" || r.industry === "hospitality"
  );
  if (!needsMigration) return records;
  const next = records.map((r) => enrichWorkRecord(r));
  saveWorkRecords(next);
  return next;
}

export function getFavorites() {
  return getStorageJson(KEY_FAV, []);
}

function getFavIdentity(item = {}) {
  return `${item.type || "employer"}:${item.id || ""}`;
}

export function toggleFavorite(item) {
  const favs = getFavorites();
  const key = getFavIdentity(item);
  const idx = favs.findIndex((f) => getFavIdentity(f) === key);
  let next;
  if (idx >= 0) {
    next = favs.filter((f) => getFavIdentity(f) !== key);
  } else {
    next = [{ ...item, savedAt: Date.now() }, ...favs];
  }
  setStorageJson(KEY_FAV, next);
  return next;
}

export function isFavorite(id, type = "employer") {
  return getFavorites().some((f) => getFavIdentity(f) === `${type}:${id}`);
}

const MATERIAL_TYPES = ["payslip", "bank", "letter", "roster"];

export function getMaterials() {
  const raw = getStorageJson(KEY_MATERIALS, {});
  return MATERIAL_TYPES.map((type) => ({
    type,
    files: raw[type] || [],
  }));
}

export function addMaterialFile(type, fileMeta) {
  const raw = getStorageJson(KEY_MATERIALS, {});
  const list = raw[type] || [];
  raw[type] = [{ id: `m-${Date.now()}`, uploadedAt: Date.now(), ...fileMeta }, ...list];
  setStorageJson(KEY_MATERIALS, raw);
  return raw;
}

export function removeMaterialFile(type, fileId) {
  const raw = getStorageJson(KEY_MATERIALS, {});
  const list = raw[type] || [];
  raw[type] = list.filter((file) => file.id !== fileId);
  setStorageJson(KEY_MATERIALS, raw);
  return raw;
}

export function getMaterialCount() {
  const raw = getStorageJson(KEY_MATERIALS, {});
  return MATERIAL_TYPES.reduce((n, t) => n + (raw[t]?.length || 0), 0);
}

const KEY_CHECKLIST = "whvChecklist";

export const DEFAULT_CHECKLIST = [
  { id: "passport", group: "证件", label: "护照（有效期>6个月）" },
  { id: "visa", group: "证件", label: "WHV 签证页截图" },
  { id: "tfn", group: "税务", label: "TFN 税号申请" },
  { id: "bank", group: "税务", label: "银行账户（推荐 ANZ/NAB）" },
  { id: "payg", group: "88天材料", label: "雇主 PAYG 汇总表" },
  { id: "payslips", group: "88天材料", label: "所有 Payslip（按日期整理）" },
  { id: "letter", group: "88天材料", label: "Employment Letter（含雇主签名）" },
  { id: "statement", group: "88天材料", label: "Bank Statement（工资入账记录）" },
  { id: "roster", group: "88天材料", label: "Roster / 排班记录" },
  { id: "photos", group: "88天材料", label: "工作现场照片（可选）" },
];

export function getChecklistState() {
  return getStorageJson(KEY_CHECKLIST, {});
}

export function toggleChecklistItem(id) {
  const state = getChecklistState();
  state[id] = !state[id];
  setStorageJson(KEY_CHECKLIST, state);
  return state;
}

export function getChecklistProgress() {
  const state = getChecklistState();
  const done = DEFAULT_CHECKLIST.filter((i) => state[i.id]).length;
  return { done, total: DEFAULT_CHECKLIST.length };
}

export const MOCK_EMPLOYERS = [
  {
    id: "e1",
    name: "Sunrise Farm Contracting",
    townId: "bundaberg",
    postcode: "4670",
    industry: "plant_animal",
    rating: 4.6,
    reviews: 28,
    payslip: true,
    lat: -24.86,
    lng: 152.35,
  },
  {
    id: "e2",
    name: "Reef City Hostel & Cafe",
    townId: "cairns",
    postcode: "4870",
    industry: "tourism_hospitality",
    rating: 4.2,
    reviews: 41,
    payslip: true,
    lat: -16.92,
    lng: 145.77,
  },
  {
    id: "e3",
    name: "Tully Banana Packers",
    townId: "tully",
    postcode: "4854",
    industry: "plant_animal",
    rating: 4.4,
    reviews: 19,
    payslip: true,
    lat: -17.93,
    lng: 145.92,
  },
  {
    id: "e4",
    name: "Outback Station Services",
    townId: "katherine",
    postcode: "0850",
    industry: "plant_animal",
    rating: 4.0,
    reviews: 12,
    payslip: false,
    lat: -14.46,
    lng: 132.26,
  },
  {
    id: "e5",
    name: "Mildura Citrus Co-op",
    townId: "mildura",
    postcode: "3500",
    industry: "plant_animal",
    rating: 4.5,
    reviews: 33,
    payslip: true,
    lat: -34.19,
    lng: 142.16,
  },
];
