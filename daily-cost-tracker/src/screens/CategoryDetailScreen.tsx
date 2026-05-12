import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppButton } from "../components/base/AppButton";
import { AppInput } from "../components/base/AppInput";
import { AppModal } from "../components/base/AppModal";
import { Category } from "../domain/models/types";
import { useCategories } from "../hooks/useCategories";
import { RootStackParamList } from "../navigation/types";
import { colors } from "../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "CategoryDetail">;

type FormState = {
  name: string;
  icon: string;
};

const initForm = (): FormState => ({ name: "", icon: "" });

export const CategoryDetailScreen = ({ navigation, route }: Props) => {
  const categoryId = route.params.categoryId;
  const {
    categories,
    loading,
    reload,
    updateOne,
    getAssetCount,
    deleteOneWithDeleteAssets,
    deleteOneWithMigration,
  } = useCategories();
  const [editVisible, setEditVisible] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [form, setForm] = useState<FormState>(initForm());
  const [pendingDeleteAssetCount, setPendingDeleteAssetCount] = useState(0);
  const [migrationTargetId, setMigrationTargetId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const category = useMemo(
    () => categories.find((item) => item.id === categoryId) ?? null,
    [categories, categoryId],
  );

  const openEdit = () => {
    if (!category) {
      return;
    }
    setForm({ name: category.name, icon: category.icon ?? "" });
    setEditVisible(true);
  };

  const openDelete = async () => {
    if (!category) {
      return;
    }
    const count = await getAssetCount(category.id);
    const targets = categories.filter((item) => item.id !== category.id);
    setPendingDeleteAssetCount(count);
    setMigrationTargetId(targets[0]?.id ?? null);
    setDeleteVisible(true);
  };

  const onSubmitEdit = async () => {
    if (!category) {
      return;
    }
    const name = form.name.trim();
    if (!name) {
      Alert.alert("输入错误", "分类名称不能为空");
      return;
    }
    await updateOne(category.id, name, form.icon.trim() || null);
    setEditVisible(false);
  };

  const deleteWithAssets = async () => {
    if (!category || deleting) {
      return;
    }
    setDeleting(true);
    try {
      await deleteOneWithDeleteAssets(category.id);
      setDeleteVisible(false);
      navigation.goBack();
    } finally {
      setDeleting(false);
    }
  };

  const deleteWithMigration = async () => {
    if (!category || migrationTargetId === null || deleting) {
      return;
    }
    setDeleting(true);
    try {
      await deleteOneWithMigration(category.id, migrationTargetId);
      setDeleteVisible(false);
      navigation.goBack();
    } finally {
      setDeleting(false);
    }
  };

  if (!category && !loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <Text style={styles.emptyText}>分类不存在或已删除</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.card}>
        <Text style={styles.name}>
          {category?.icon ? `${category.icon} ` : ""}
          {category?.name ?? "分类"}
        </Text>
        <Text style={styles.desc}>{category?.isDefault === 1 ? "系统默认分类" : "自定义分类"}</Text>
      </View>

      <View style={styles.actions}>
        <AppButton title="编辑分类" variant="secondary" onPress={openEdit} />
        <AppButton title="删除分类" variant="danger" onPress={openDelete} />
      </View>

      <AppModal visible={editVisible} title="编辑分类" onClose={() => setEditVisible(false)}>
        <View style={styles.modalContent}>
          <AppInput
            label="分类名称"
            value={form.name}
            onChangeText={(value) => setForm((prev) => ({ ...prev, name: value }))}
            placeholder="例如 数码"
          />
          <AppInput
            label="图标（可选）"
            value={form.icon}
            onChangeText={(value) => setForm((prev) => ({ ...prev, icon: value }))}
            placeholder="例如 💻"
          />
          <AppButton title="保存修改" onPress={onSubmitEdit} />
        </View>
      </AppModal>

      <AppModal visible={deleteVisible} title="删除分类处理" onClose={() => setDeleteVisible(false)}>
        <View style={styles.modalContent}>
          <Text style={styles.deleteHintText}>
            {pendingDeleteAssetCount > 0
              ? `该分类下有 ${pendingDeleteAssetCount} 条资产记录，请选择处理方式。`
              : "该分类下没有资产记录，可直接删除。"}
          </Text>
          {pendingDeleteAssetCount > 0 ? (
            <>
              <Text style={styles.label}>迁移到分类</Text>
              <View style={styles.rowWrap}>
                {categories
                  .filter((item) => item.id !== categoryId)
                  .map((item) => (
                    <Text
                      key={item.id}
                      onPress={() => setMigrationTargetId(item.id)}
                      style={[
                        styles.chip,
                        migrationTargetId === item.id ? styles.chipActive : undefined,
                      ]}
                    >
                      {item.icon ? `${item.icon} ` : ""}
                      {item.name}
                    </Text>
                  ))}
              </View>
              <AppButton
                title={deleting ? "处理中..." : "迁移资产并删除分类"}
                onPress={deleteWithMigration}
                loading={deleting}
                disabled={deleting || migrationTargetId === null}
              />
              <AppButton
                title={deleting ? "处理中..." : "删除分类及其资产"}
                variant="danger"
                onPress={deleteWithAssets}
                disabled={deleting}
              />
            </>
          ) : (
            <AppButton
              title={deleting ? "处理中..." : "确认删除分类"}
              variant="danger"
              onPress={deleteWithAssets}
              disabled={deleting}
            />
          )}
        </View>
      </AppModal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 16,
    gap: 12,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 14,
    gap: 6,
  },
  name: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  desc: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  actions: {
    gap: 10,
  },
  modalContent: {
    gap: 10,
  },
  deleteHintText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  label: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "600",
  },
  rowWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#fff",
    color: colors.textSecondary,
    fontSize: 13,
    overflow: "hidden",
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: "rgba(78, 124, 255, 0.14)",
    color: colors.primary,
    fontWeight: "600",
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
});
