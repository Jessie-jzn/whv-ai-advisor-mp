export default defineAppConfig({
  pages: [
    "pages/home/index",
    "pages/calculator/index",
    "pages/ai/index",
    "pages/map/index",
    "pages/profile/index",
    "pages/materials/index",
    "pages/postcode/index",
  ],
  window: {
    navigationBarTitleText: "WHV Helper",
    navigationBarBackgroundColor: "#2C5F2E",
    navigationBarTextStyle: "white",
    backgroundColor: "#F6F0E4",
    backgroundTextStyle: "dark",
  },
  tabBar: {
    color: "#9a9a9a",
    selectedColor: "#2C5F2E",
    backgroundColor: "#F6F0E4",
    borderStyle: "white",
    list: [
      {
        pagePath: "pages/home/index",
        text: "首页",
        iconPath: "assets/tab/home.png",
        selectedIconPath: "assets/tab/home_active.png",
      },
      {
        pagePath: "pages/calculator/index",
        text: "88天",
        iconPath: "assets/tab/calc.png",
        selectedIconPath: "assets/tab/calc_active.png",
      },
      {
        pagePath: "pages/ai/index",
        text: "AI助手",
        iconPath: "assets/tab/ai.png",
        selectedIconPath: "assets/tab/ai_active.png",
      },
      {
        pagePath: "pages/map/index",
        text: "地图",
        iconPath: "assets/tab/map.png",
        selectedIconPath: "assets/tab/map_active.png",
      },
      {
        pagePath: "pages/profile/index",
        text: "我的",
        iconPath: "assets/tab/profile.png",
        selectedIconPath: "assets/tab/profile_active.png",
      },
    ],
  },
});
