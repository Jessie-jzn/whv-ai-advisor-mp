import { View, Text, Button, ScrollView } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useState } from "react";
import {
  getMaterials,
  addMaterialFile,
  removeMaterialFile,
  calcProgress,
  DEFAULT_CHECKLIST,
  getChecklistState,
  toggleChecklistItem,
  getChecklistProgress,
} from "../../utils/userStore";
import "./index.scss";

const TABS = [
  { id: "checklist", label: "Checklist" },
  { id: "payslip", label: "Payslip" },
];

export default function Materials() {
  const [tab, setTab] = useState("checklist");
  const [materials, setMaterials] = useState(getMaterials());
  const [checklist, setChecklist] = useState(getChecklistState());
  const progress = calcProgress();
  const checkProg = getChecklistProgress();
  const totalDone = checkProg.done + materials.reduce((n, m) => n + m.files.length, 0);
  const totalAll = checkProg.total + 4;
  const pct = Math.min(100, Math.round((totalDone / totalAll) * 100));

  const refresh = () => {
    setMaterials(getMaterials());
    setChecklist(getChecklistState());
  };

  const saveSelectedFiles = (type, files = [], fallbackPrefix = type) => {
    files.forEach((file, i) => {
      const path = file.path || file.tempFilePath || file;
      addMaterialFile(type, {
        name: file.name || `${fallbackPrefix}-${Date.now()}-${i}`,
        path,
        size: file.size || 0,
      });
    });
    refresh();
    Taro.showToast({ title: "上传成功", icon: "success" });
  };

  const uploadPhotos = (type) => {
    Taro.chooseImage({
      count: 3,
      sizeType: ["compressed"],
      sourceType: ["album", "camera"],
      success: (res) => {
        saveSelectedFiles(type, res.tempFiles || res.tempFilePaths, `${type}-photo`);
      },
    });
  };

  const uploadDocuments = (type) => {
    if (!Taro.chooseMessageFile) {
      Taro.showToast({ title: "当前环境不支持选择文件", icon: "none" });
      return;
    }
    Taro.chooseMessageFile({
      count: 3,
      type: "file",
      extension: ["pdf", "doc", "docx"],
      success: (res) => {
        saveSelectedFiles(type, res.tempFiles || [], `${type}-file`);
      },
    });
  };

  const upload = (type) => {
    Taro.showActionSheet({
      itemList: ["照片（JPG / PNG）", "PDF / Word 文件"],
      success: (res) => {
        if (res.tapIndex === 0) uploadPhotos(type);
        if (res.tapIndex === 1) uploadDocuments(type);
      },
    });
  };

  const deleteFile = (type, file) => {
    Taro.showModal({
      title: "删除文件",
      content: "确定删除这个上传文件？",
      success: (res) => {
        if (!res.confirm) return;
        removeMaterialFile(type, file.id);
        refresh();
        Taro.showToast({ title: "已删除", icon: "none" });
      },
    });
  };

  const toggleCheck = (id) => {
    toggleChecklistItem(id);
    refresh();
  };

  const groups = [...new Set(DEFAULT_CHECKLIST.map((i) => i.group))];
  const currentTab = TABS.find((t) => t.id === tab) || TABS[0];
  const currentFiles = materials.find((m) => m.type === tab)?.files || [];

  const formatDate = (ts) => {
    if (!ts) return "刚刚上传";
    const d = new Date(ts);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const exportReport = () => {
    Taro.setClipboardData({
      data: `WHV 材料报告\n88天: ${progress.totalDays}/${progress.target}\nChecklist: ${checkProg.done}/${checkProg.total}`,
      success: () => Taro.showToast({ title: "已复制", icon: "success" }),
    });
  };

  return (
    <View className="page">
      <View className="page-body">
        <View className="card">
          <View className="mat-progress-head">
            <Text className="section-title">材料完成度</Text>
            <Text className="mat-progress-num">{checkProg.done}/{checkProg.total}</Text>
          </View>
          <View className="progress-bar progress-bar-light">
            <View className="progress-fill progress-fill-green" style={{ width: `${pct}%` }} />
          </View>
        </View>

        <ScrollView scrollX className="pill-tabs-scroll" enableFlex>
          {TABS.map((t) => (
            <View
              key={t.id}
              className={`mat-tab ${tab === t.id ? "mat-tab-active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </View>
          ))}
        </ScrollView>

        {tab === "checklist" ? (
          <View className="card">
            {groups.map((group) => (
              <View key={group}>
                <Text className="check-group-label">{group}</Text>
                {DEFAULT_CHECKLIST.filter((i) => i.group === group).map((item) => (
                  <View key={item.id} className="check-item" onClick={() => toggleCheck(item.id)}>
                    <View className={`check-circle ${checklist[item.id] ? "check-circle-done" : ""}`}>
                      {checklist[item.id] ? "✓" : ""}
                    </View>
                    <Text className={`check-text ${checklist[item.id] ? "check-text-done" : ""}`}>
                      {item.label}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        ) : (
          <View>
            <View className="upload-zone" onClick={() => upload(tab)}>
              <Text className="upload-icon">↥</Text>
              <Text className="upload-title">上传文件</Text>
              <Text className="upload-desc">支持 PDF、Word、JPG、PNG，最多 3 个文件</Text>
              <Button
                className="choose-file-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  upload(tab);
                }}
              >
                选择文件
              </Button>
            </View>

            {currentFiles.length > 0 && (
              <>
                <View className="uploaded-head">
                  <Text className="uploaded-title">已上传</Text>
                  <Text className="uploaded-type">{currentTab.label.toUpperCase()}</Text>
                </View>

                {currentFiles.map((file, index) => (
                  <View key={file.id || file.path || index} className="file-card">
                    <View className="file-icon">
                      <Text>▤</Text>
                    </View>
                    <View className="file-main">
                      <Text className="file-name">{currentTab.label} 文件 {currentFiles.length - index}</Text>
                      <Text className="file-meta">{formatDate(file.uploadedAt)}</Text>
                    </View>
                    <Text className="file-delete" onClick={() => deleteFile(tab, file)}>删除</Text>
                  </View>
                ))}
              </>
            )}
          </View>
        )}

        <Button className="btn-amber export-btn" onClick={exportReport}>导出报告</Button>
      </View>
    </View>
  );
}
