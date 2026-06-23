import { View, Text, Input, Button, Picker, ScrollView } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import { useEffect, useState } from "react";
import PageHeader from "../../components/PageHeader";
import {
  getWorkRecords,
  addWorkRecord,
  removeWorkRecord,
  calcProgress,
  getVisaGoal,
  setVisaGoal,
  migrateWorkRecords,
  getMaterials,
} from "../../utils/userStore";
import {
  INDUSTRY_LABELS as FORM_INDUSTRY_LABELS,
  AREA_LABELS,
  checkEligibility,
} from "../../utils/eligibility";
import { INDUSTRY_LABELS } from "../../utils/townLookup";
import "./index.scss";

const INDUSTRIES = Object.entries(FORM_INDUSTRY_LABELS)
  .filter(([id]) => !["farm", "hospitality", "tourism"].includes(id))
  .map(([id, label]) => ({ id, label }));

const VISA_GOALS = [
  { id: "second", label: "二签（88 天）" },
  { id: "third", label: "三签（179 天）" },
];

const EMPTY_FORM = {
  employer: "",
  postcode: "",
  startDate: "",
  hours: "",
  earnings: "",
  industry: "",
};

export default function Calculator() {
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [goal, setGoal] = useState(getVisaGoal());

  const refresh = () => {
    migrateWorkRecords();
    setRecords(getWorkRecords());
    setGoal(getVisaGoal());
  };

  useDidShow(refresh);

  const progress = calcProgress(records, goal);
  const payslipCount = (getMaterials().find((m) => m.type === "payslip")?.files || []).length;
  const industryIndex = INDUSTRIES.findIndex((i) => i.id === form.industry);
  const pickerIndustryIndex = Math.max(0, industryIndex);
  const goalIndex = goal === "third" ? 1 : 0;

  const previewCheck =
    form.postcode.length >= 3 && form.industry
      ? checkEligibility(form.postcode, form.industry, { employmentType: "paid" })
      : null;
  const previewAreas =
    previewCheck?.areas?.length > 0
      ? previewCheck.areas.map((a) => AREA_LABELS[a] || a).join("、")
      : "无区域";

  const updateForm = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  useEffect(() => {
    if (showForm) {
      Taro.hideTabBar({ animation: false, fail: () => {} });
      return () => Taro.showTabBar({ animation: false, fail: () => {} });
    }
    Taro.showTabBar({ animation: false, fail: () => {} });
    return undefined;
  }, [showForm]);

  const onGoalChange = (e) => {
    const g = VISA_GOALS[Number(e.detail.value)]?.id || "second";
    setVisaGoal(g);
    setGoal(g);
  };

  const submitRecord = () => {
    if (!form.employer.trim()) {
      Taro.showToast({ title: "请填写雇主", icon: "none" });
      return;
    }
    if (!/^\d{3,4}$/.test(form.postcode.trim())) {
      Taro.showToast({ title: "请填写正确邮编", icon: "none" });
      return;
    }
    if (!form.industry) {
      Taro.showToast({ title: "请选择行业", icon: "none" });
      return;
    }
    if (!form.startDate) {
      Taro.showToast({ title: "请选择工作日期", icon: "none" });
      return;
    }
    if (!(Number(form.hours) > 0)) {
      Taro.showToast({ title: "请填写工时", icon: "none" });
      return;
    }
    addWorkRecord({
      employer: form.employer.trim(),
      location: "",
      postcode: form.postcode.trim(),
      startDate: form.startDate,
      endDate: form.startDate,
      daysWorked: 1,
      weeklyDays: 5,
      hours: Number(form.hours) || 0,
      earnings: Number(form.earnings) || 0,
      industry: form.industry,
      employmentType: "paid",
    });
    setForm(EMPTY_FORM);
    setShowForm(false);
    refresh();
    Taro.showToast({ title: "已添加", icon: "success" });
  };

  const onDelete = (id) => {
    Taro.showModal({
      title: "删除记录",
      content: "确定删除？",
      success: (res) => {
        if (res.confirm) {
          removeWorkRecord(id);
          refresh();
        }
      },
    });
  };

  const repeatRecord = (record) => {
    setForm({
      employer: record.employer || "",
      postcode: record.postcode || "",
      industry: record.industry || "plant_animal",
      startDate: "",
      hours: "",
      earnings: "",
    });
    setShowForm(true);
  };

  const openNewRecordForm = () => {
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const targetLabel = goal === "third" ? "三签" : "二签";

  return (
    <View className="page">
      <PageHeader title="88天计算器" />

      <View className="page-body">
        <View className="card">
          <View className="calc-progress-head">
            <Picker
              mode="selector"
              range={VISA_GOALS.map((g) => g.label)}
              value={goalIndex}
              onChange={onGoalChange}
            >
              <Text className="calc-label">{targetLabel} 进度 ▾</Text>
            </Picker>
            <Text className="calc-remain">
              有效还差 <Text className="amber">{progress.remaining}</Text> 天
            </Text>
          </View>
          <View className="calc-big-num">
            <Text className="num-green">{progress.eligibleDays}</Text>
            <Text className="num-slash"> / </Text>
            <Text className="num-grey">{progress.target}</Text>
            <Text className="num-unit"> 天</Text>
          </View>
          <View className="progress-bar progress-bar-light">
            <View
              className="progress-fill progress-fill-green"
              style={{ width: `${progress.percent}%` }}
            />
          </View>
          <View className="calc-progress-foot">
            <Text>{progress.percent}% · 原始 {progress.rawDays} 天</Text>
            <Text>日历跨度 {progress.calendarSpan} 天{progress.calendarOk ? " ✓" : ""}</Text>
          </View>
        </View>

        {progress.warnings?.length > 0 && (
          <View className="card calc-warn-card">
            {progress.warnings.slice(0, 3).map((w) => (
              <Text key={w} className="calc-warn">{w}</Text>
            ))}
          </View>
        )}

        <View className="stat-row">
          <View className="stat-box">
            <Text className="stat-icon">⏱</Text>
            <Text className="stat-val">{progress.totalHours}h</Text>
            <Text className="stat-lbl">总工时</Text>
          </View>
          <View className="stat-box">
            <Text className="stat-icon">$</Text>
            <Text className="stat-val">${Math.round(progress.totalIncome)}</Text>
            <Text className="stat-lbl">总收入</Text>
          </View>
          <View className="stat-box">
            <Text className="stat-icon">📄</Text>
            <Text className="stat-val">{payslipCount}条</Text>
            <Text className="stat-lbl">Payslip</Text>
          </View>
        </View>

        <Button className="btn-primary add-btn" onClick={openNewRecordForm}>
          + 新增工作记录
        </Button>

        {showForm && (
          <View className="form-sheet-mask" onClick={() => setShowForm(false)}>
            <View className="form-sheet" onClick={(e) => e.stopPropagation()}>
              <View className="form-head">
                <Text className="form-title">新增工作记录</Text>
                <Text className="form-close" onClick={() => setShowForm(false)}>×</Text>
              </View>

              <ScrollView scrollY className="form-sheet-body">
                <View className="form-section">
                  <Text className="label">雇主 / 农场 *</Text>
                  <Input
                    className="input"
                    placeholder="如 Sunrise Farm"
                    value={form.employer}
                    onInput={(e) => updateForm("employer", e.detail.value)}
                  />
                  <Text className="label">邮编 *</Text>
                  <Input
                    className="input"
                    type="number"
                    placeholder="如 4670"
                    value={form.postcode}
                    onInput={(e) => updateForm("postcode", e.detail.value)}
                  />
                  {previewCheck && (
                    <View className={`elig-preview ${previewCheck.eligible ? "elig-ok" : "elig-no"}`}>
                      <Text className="elig-preview-title">
                        {previewCheck.eligible ? "可计入" : "可能不计入"}
                      </Text>
                      <Text className="elig-preview-detail">
                        {previewCheck.state || "未知州"} · {previewAreas}
                      </Text>
                    </View>
                  )}
                  <Text className="label">行业 *</Text>
                  <Picker
                    mode="selector"
                    range={INDUSTRIES.map((i) => i.label)}
                    value={pickerIndustryIndex}
                    onChange={(e) => updateForm("industry", INDUSTRIES[Number(e.detail.value)]?.id)}
                  >
                    <View className={`picker ${form.industry ? "" : "picker-placeholder"}`}>
                      {form.industry ? INDUSTRIES[industryIndex]?.label : "请选择行业"}
                    </View>
                  </Picker>
                </View>

                <View className="form-section">
                  <Text className="label">工作日期 *</Text>
                  <Picker mode="date" value={form.startDate} onChange={(e) => updateForm("startDate", e.detail.value)}>
                    <View className={`picker ${form.startDate ? "" : "picker-placeholder"}`}>
                      {form.startDate || "选择日期"}
                    </View>
                  </Picker>
                  <View className="form-row">
                    <View className="form-col">
                      <Text className="label">工时 *</Text>
                      <Input
                        className="input"
                        type="number"
                        placeholder="如 8"
                        value={form.hours}
                        onInput={(e) => updateForm("hours", e.detail.value)}
                      />
                    </View>
                    <View className="form-col">
                      <Text className="label">薪资 AUD</Text>
                      <Input
                        className="input"
                        type="number"
                        placeholder="如 200"
                        value={form.earnings}
                        onInput={(e) => updateForm("earnings", e.detail.value)}
                      />
                    </View>
                  </View>
                </View>
              </ScrollView>

              <View className="form-actions">
                <Button className="btn-primary save-btn" onClick={submitRecord}>保存记录</Button>
              </View>
            </View>
          </View>
        )}

        {records.length === 0 ? (
          <Text className="empty-hint">暂无记录，点击上方添加</Text>
        ) : (
          records.map((r) => {
            const income = r.earnings || (r.hours || 0) * 28;
            return (
              <View key={r.id} className="card record-card">
                <View className="record-top">
                  <View>
                    <Text className="record-title">{r.employer}</Text>
                    <Text className="record-sub">
                      {r.startDate || "未填日期"} · {r.postcode || r.location || "—"} · {INDUSTRY_LABELS[r.industry]?.slice(0, 8) || "工作"}
                    </Text>
                  </View>
                  <View className="record-actions">
                    <Text className="record-repeat" onClick={() => repeatRecord(r)}>再来一条</Text>
                    <Text className="record-del" onClick={() => onDelete(r.id)}>删除</Text>
                  </View>
                </View>
                <View className="record-bottom">
                  <Text className="record-hours">{r.hours || 0}h</Text>
                  <Text className="record-income">${Math.round(income)} AUD</Text>
                </View>
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}
