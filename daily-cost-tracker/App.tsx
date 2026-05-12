import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { initDatabase } from "./src/db/database";
import { colors } from "./src/theme/colors";
import { useAppStateRefresh } from "./src/hooks/useAppStateRefresh";
import { AssetProvider } from "./src/contexts/AssetContext";
import { SettingsProvider } from "./src/contexts/SettingsContext";

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useAppStateRefresh();

  useEffect(() => {
    const bootstrap = async () => {
      try {
        await initDatabase();
        setReady(true);
      } catch (dbError) {
        const message =
          dbError instanceof Error ? dbError.message : "未知数据库错误";
        setError(message);
      }
    };

    void bootstrap();
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AssetProvider>
          <SettingsProvider>
            {error ? (
              <View style={styles.centered}>
                <Text style={styles.errorTitle}>数据初始化失败</Text>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : ready ? (
              <RootNavigator />
            ) : (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>正在初始化本地数据...</Text>
              </View>
            )}
          </SettingsProvider>
        </AssetProvider>
        <StatusBar style="dark" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    paddingHorizontal: 24,
  },
  loadingText: {
    marginTop: 12,
    color: colors.textSecondary,
    fontSize: 14,
  },
  errorTitle: {
    color: colors.error,
    fontWeight: "700",
    fontSize: 18,
  },
  errorText: {
    marginTop: 8,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
