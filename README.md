# WHV 集签助手（Taro 跨端）

基于 **Taro 4 + React** 的 WHV 集签规划小程序，支持 **微信小程序** 与 **H5**。

## 页面结构

```
首页
├── 输入邮编 / 城镇查询
├── 88天计算器入口
├── AI 集签助手入口
├── 热门集签城镇
└── 最新用户投稿

邮编查询页
├── 查询结果 / 区域类型 / 适用签证
├── 常见工作 / 风险提示

88天计算器页
├── 新增工作记录 / 工时记录
├── Payslip 上传 / 当前进度 / 还差多少天

AI 集签助手页
├── 我的情况输入 / 推荐城镇
├── 推荐工作类型 / 风险分析 / 下一步行动

工作地图页（Tab）
├── 地图 / 筛选器 / 雇主详情
├── 用户评价 / 收藏

材料中心页（Tab）
├── Payslip / Bank Statement / Employment Letter / Roster
├── Checklist / 导出报告

我的页面（Tab）
├── 集签进度 / 收藏 / 报告 / 会员 / 咨询
```

## 开发

```bash
nvm use          # Node 18+，推荐 22
npm install

npm run dev:weapp   # 微信开发者工具打开项目根目录
npm run dev:h5      # 浏览器预览
```

## 配置

- `project.config.json` — 填写小程序 AppID
- `src/utils/config.js` — Cloudflare Worker URL
- 微信公众平台配置 request 合法域名

## 目录

```
src/
  pages/home/         首页
  pages/postcode/     邮编查询
  pages/calculator/   88天计算器
  pages/ai/           AI 集签助手
  pages/map/          工作地图
  pages/materials/    材料中心
  pages/profile/      我的
  data/               城镇知识库 & 投稿
  utils/              推荐 / LLM / 缓存 / 查询
```

## 说明

- 地图雇主、用户投稿为 **演示数据**，后续可接 API
- 88天计算与材料上传存 **本地 Storage**
- AI 推荐逻辑与原版一致（本地 + 可选云路由）
