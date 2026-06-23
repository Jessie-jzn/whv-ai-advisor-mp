import { View, Text } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useMemo } from "react";
import "./PageHeader.scss";

export default function PageHeader({ title, showBell = true }) {
  const statusBarHeight = useMemo(() => {
    try {
      return Taro.getSystemInfoSync().statusBarHeight || 44;
    } catch {
      return 44;
    }
  }, []);

  return (
    <View className="page-header" style={{ paddingTop: `${statusBarHeight}px` }}>
      <View className="page-header-top">
        <Text className="page-header-brand">🦘 WHV HELPER</Text>
        {showBell && (
          <View className="page-header-bell">
            <Text>🔔</Text>
            <View className="page-header-bell-dot" />
          </View>
        )}
      </View>
      <Text className="page-header-title">{title}</Text>
    </View>
  );
}
