import { useLaunch } from "@tarojs/taro";
import Taro from "@tarojs/taro";
import { migrateWorkRecords } from "./utils/userStore";
import "./app.scss";

const FONTS = [
  {
    family: "Nunito",
    source: 'url("https://fonts.gstatic.com/s/nunito/v26/XRXI3I6Li01BKofiOc5wtlZ2di8HDLshdTQ3j77e.woff2")',
  },
  {
    family: "DM Serif Display",
    source: 'url("https://fonts.gstatic.com/s/dmserifdisplay/v15/-nFh4GqxxsWG7PHBr0y3YpEm.woff2")',
  },
];

function App({ children }) {
  useLaunch(() => {
    FONTS.forEach(({ family, source }) => {
      Taro.loadFontFace({ family, source, global: true }).catch(() => {});
    });
    migrateWorkRecords();
  });

  return children;
}

export default App;
