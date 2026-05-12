import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAssets } from "../../hooks/useAssets";
import { RootStackParamList } from "../../navigation/types";
import {
  exportBackup,
  getLocalStorageUsage,
  importBackup,
  BackupImportMode,
  BackupPreviewResult,
  pickBackupForImport,
} from "../../services/backupService";
import { colors } from "../../theme/colors";

export const ProfileScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { reload: reloadAssets } = useAssets();
  const [storageLabel, setStorageLabel] = useState("计算中...");
  const [busyAction, setBusyAction] = useState<"import" | "export" | null>(null);

  const refreshStorage = useCallback(async () => {
    const info = await getLocalStorageUsage();
    setStorageLabel(info.label);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshStorage();
    }, [refreshStorage]),
  );

  const onExport = async () => {
    if (busyAction) {
      return;
    }
    try {
      setBusyAction("export");
      const result = await exportBackup();
      await refreshStorage();
      Alert.alert(
        "导出成功",
        `已导出 ${result.sizeLabel}\n资产 ${result.counts.assets} 条，心愿 ${result.counts.wishes} 条`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "导出失败";
      Alert.alert("导出失败", message);
    } finally {
      setBusyAction(null);
    }
  };

  const runImport = async (
    preview: BackupPreviewResult & { canceled: false },
    mode: BackupImportMode,
  ) => {
    if (busyAction) {
      return;
    }
    try {
      setBusyAction("import");
      const result = await importBackup(preview, mode);
      await reloadAssets();
      await refreshStorage();
      Alert.alert(
        "导入成功",
        `${mode === "overwrite" ? "覆盖" : "新增"}导入完成\n资产 ${result.counts.assets} 条，心愿 ${result.counts.wishes} 条`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "导入失败";
      Alert.alert("导入失败", message);
    } finally {
      setBusyAction(null);
    }
  };

  const confirmOverwrite = (preview: BackupPreviewResult & { canceled: false }) => {
    Alert.alert(
      "最终确认：覆盖导入",
      "覆盖导入会清空当前本地数据，然后写入备份内容。该操作不可撤销。",
      [
        { text: "取消", style: "cancel" },
        {
          text: "确认覆盖",
          style: "destructive",
          onPress: () => {
            void runImport(preview, "overwrite");
          },
        },
      ],
      { cancelable: true },
    );
  };

  const onImport = async () => {
    if (busyAction) {
      return;
    }
    const preview = await pickBackupForImport();
    if (preview.canceled) {
      return;
    }
    const summary = `文件：${preview.fileName}\n导出时间：${new Date(preview.exportedAt).toLocaleString()}\n资产 ${preview.counts.assets} 条，心愿 ${preview.counts.wishes} 条`;
    Alert.alert(
      "导入备份",
      `${summary}\n\n请选择导入方式：`,
      [
        { text: "取消", style: "cancel" },
        {
          text: "新增导入",
          onPress: () => {
            void runImport(preview, "append");
          },
        },
        {
          text: "覆盖导入",
          style: "destructive",
          onPress: () => {
            confirmOverwrite(preview);
          },
        },
      ],
      { cancelable: true },
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Text style={styles.title}>个人中心</Text>
      <View style={styles.card}>
        <Pressable
          style={({ pressed }) => [styles.menuItem, pressed ? styles.menuItemPressed : undefined]}
          onPress={() => navigation.navigate("CategoryManage")}
        >
          <Text style={styles.menuTitle}>分类管理</Text>
          <Text style={styles.menuArrow}>›</Text>
        </Pressable>
        <View style={styles.divider} />
        <Pressable
          style={({ pressed }) => [styles.menuItem, pressed ? styles.menuItemPressed : undefined]}
          onPress={() => {
            void onExport();
          }}
          disabled={busyAction !== null}
        >
          <View>
            <Text style={styles.menuTitle}>导出备份</Text>
            <Text style={styles.menuDesc}>导出为 JSON 文件，用于迁移</Text>
          </View>
          <Text style={styles.menuArrow}>{busyAction === "export" ? "导出中..." : "›"}</Text>
        </Pressable>
        <View style={styles.divider} />
        <Pressable
          style={({ pressed }) => [styles.menuItem, pressed ? styles.menuItemPressed : undefined]}
          onPress={() => {
            void onImport();
          }}
          disabled={busyAction !== null}
        >
          <View>
            <Text style={styles.menuTitle}>导入备份</Text>
            <Text style={styles.menuDesc}>支持新增导入与覆盖导入</Text>
          </View>
          <Text style={styles.menuArrow}>{busyAction === "import" ? "导入中..." : "›"}</Text>
        </Pressable>
        <View style={styles.divider} />
        <View style={styles.menuItem}>
          <View>
            <Text style={styles.menuTitle}>本地存储状态</Text>
            <Text style={styles.menuDesc}>全部数据本地存储</Text>
          </View>
          <Text style={styles.menuStorage}>{storageLabel}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 12,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  menuItem: {
    minHeight: 52,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  menuItemPressed: {
    opacity: 0.8,
  },
  menuTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "600",
  },
  menuArrow: {
    color: colors.textSecondary,
    fontSize: 18,
  },
  menuDesc: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  menuStorage: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
});
