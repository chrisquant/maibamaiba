import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from "react-native-draggable-flatlist";
import { Swipeable } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppButton } from "../components/base/AppButton";
import { AppInput } from "../components/base/AppInput";
import { AppModal } from "../components/base/AppModal";
import { Category } from "../domain/models/types";
import { useCategories } from "../hooks/useCategories";
import { RootStackParamList } from "../navigation/types";
import { colors } from "../theme/colors";

type FormState = {
  name: string;
  icon: string;
};

const initForm = (): FormState => ({ name: "", icon: "" });

export const CategoryManageScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    categories,
    loading,
    reload,
    createOne,
    updateOne,
    getAssetCount,
    deleteOneWithDeleteAssets,
    deleteOneWithMigration,
    saveOrder,
  } = useCategories();
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState<FormState>(initForm());
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null);
  const [pendingDeleteAssetCount, setPendingDeleteAssetCount] = useState(0);
  const [migrationTargetId, setMigrationTargetId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [ordering, setOrdering] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const openCreate = () => {
    setEditing(null);
    setForm(initForm());
    setModalVisible(true);
  };

  const openEdit = (item: Category) => {
    setEditing(item);
    setForm({ name: item.name, icon: item.icon ?? "" });
    setModalVisible(true);
  };

  const onSubmit = async () => {
    const name = form.name.trim();
    if (!name) {
      Alert.alert("输入错误", "分类名称不能为空");
      return;
    }
    if (editing) {
      await updateOne(editing.id, name, form.icon.trim() || null);
    } else {
      await createOne(name, form.icon.trim() || null);
    }
    setModalVisible(false);
  };

  const onDelete = (item: Category) => {
    Alert.alert("删除确认", `确认删除分类“${item.name}”吗？`, [
      { text: "取消", style: "cancel" },
      {
        text: "继续",
        onPress: async () => {
          const count = await getAssetCount(item.id);
          const targets = categories.filter((category) => category.id !== item.id);
          setPendingDelete(item);
          setPendingDeleteAssetCount(count);
          setMigrationTargetId(targets[0]?.id ?? null);
          setDeleteModalVisible(true);
        },
      },
    ]);
  };

  const handleDragEnd = async ({ data }: { data: Category[] }) => {
    if (ordering) {
      return;
    }
    setOrdering(true);
    try {
      await saveOrder(data.map((item) => item.id));
    } finally {
      setOrdering(false);
    }
  };

  const handleDeleteWithAssets = async () => {
    if (!pendingDelete || deleting) {
      return;
    }
    setDeleting(true);
    try {
      await deleteOneWithDeleteAssets(pendingDelete.id);
      setDeleteModalVisible(false);
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const renderRightActions = (item: Category) => (
    <View style={styles.swipeActions}>
      <Pressable onPress={() => openEdit(item)} style={[styles.swipeActionBtn, styles.swipeEdit]}>
        <Text style={styles.swipeActionText}>编辑</Text>
      </Pressable>
      <Pressable onPress={() => onDelete(item)} style={[styles.swipeActionBtn, styles.swipeDelete]}>
        <Text style={styles.swipeActionText}>删除</Text>
      </Pressable>
    </View>
  );

  const renderCategoryItem = ({ item, drag, isActive }: RenderItemParams<Category>) => (
    <ScaleDecorator>
      <Swipeable renderRightActions={() => renderRightActions(item)}>
        <Pressable
          style={[styles.itemCard, isActive ? styles.itemCardActive : undefined]}
          onPress={() => navigation.navigate("CategoryDetail", { categoryId: item.id })}
        >
          <View style={styles.itemInfo}>
            <Text style={styles.itemName}>
              {item.icon ? `${item.icon} ` : ""}
              {item.name}
            </Text>
            <Text style={styles.itemDesc}>
              {item.isDefault === 1 ? "系统默认分类 · 左滑可编辑/删除" : "自定义分类 · 左滑可编辑/删除"}
            </Text>
          </View>
          <Pressable
            onLongPress={drag}
            delayLongPress={120}
            style={styles.dragHandle}
            disabled={ordering}
          >
            <Ionicons name="reorder-three-outline" size={18} color={colors.textSecondary} />
          </Pressable>
        </Pressable>
      </Swipeable>
    </ScaleDecorator>
  );

  const handleDeleteWithMigration = async () => {
    if (!pendingDelete || migrationTargetId === null || deleting) {
      return;
    }
    setDeleting(true);
    try {
      await deleteOneWithMigration(pendingDelete.id, migrationTargetId);
      setDeleteModalVisible(false);
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.topBar}>
        <Text style={styles.title}>分类管理</Text>
        <AppButton title="新增分类" onPress={openCreate} />
      </View>

      <DraggableFlatList
        data={categories}
        keyExtractor={(item) => String(item.id)}
        onRefresh={reload}
        refreshing={loading}
        contentContainerStyle={styles.list}
        renderItem={renderCategoryItem}
        onDragEnd={handleDragEnd}
      />

      <AppModal
        visible={modalVisible}
        title={editing ? "编辑分类" : "新增分类"}
        onClose={() => setModalVisible(false)}
      >
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
          <AppButton title={editing ? "保存修改" : "保存分类"} onPress={onSubmit} />
        </View>
      </AppModal>

      <AppModal
        visible={deleteModalVisible}
        title="删除分类处理"
        onClose={() => {
          setDeleteModalVisible(false);
          setPendingDelete(null);
        }}
      >
        <View style={styles.modalContent}>
          <Text style={styles.deleteHintText}>
            {pendingDeleteAssetCount > 0
              ? `分类“${pendingDelete?.name ?? ""}”下有 ${pendingDeleteAssetCount} 条资产记录，请选择处理方式。`
              : `分类“${pendingDelete?.name ?? ""}”下没有资产记录，可直接删除。`}
          </Text>

          {pendingDeleteAssetCount > 0 ? (
            <>
              <Text style={styles.label}>迁移到分类</Text>
              <View style={styles.rowWrap}>
                {categories
                  .filter((item) => item.id !== pendingDelete?.id)
                  .map((item) => (
                    <Pressable
                      key={item.id}
                      style={[
                        styles.chip,
                        migrationTargetId === item.id ? styles.chipActive : undefined,
                      ]}
                      onPress={() => setMigrationTargetId(item.id)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          migrationTargetId === item.id ? styles.chipTextActive : undefined,
                        ]}
                      >
                        {item.icon ? `${item.icon} ` : ""}
                        {item.name}
                      </Text>
                    </Pressable>
                  ))}
              </View>
            </>
          ) : null}

          {pendingDeleteAssetCount > 0 ? (
            <>
              <AppButton
                title={deleting ? "处理中..." : "迁移资产并删除分类"}
                onPress={handleDeleteWithMigration}
                disabled={migrationTargetId === null || deleting}
                loading={deleting}
              />
              <AppButton
                title={deleting ? "处理中..." : "删除分类及其资产"}
                variant="danger"
                onPress={handleDeleteWithAssets}
                disabled={deleting}
              />
            </>
          ) : (
            <AppButton
              title={deleting ? "处理中..." : "确认删除分类"}
              variant="danger"
              onPress={handleDeleteWithAssets}
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
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    gap: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  list: {
    gap: 10,
    paddingBottom: 20,
  },
  itemCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  itemCardActive: {
    opacity: 0.9,
  },
  itemInfo: {
    flex: 1,
    gap: 3,
  },
  itemName: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  itemDesc: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  itemActions: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  dragHandle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(78, 124, 255, 0.08)",
  },
  swipeActions: {
    width: 132,
    flexDirection: "row",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 10,
  },
  swipeActionBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  swipeEdit: {
    backgroundColor: colors.primary,
  },
  swipeDelete: {
    backgroundColor: colors.error,
  },
  swipeActionText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
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
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: "rgba(78, 124, 255, 0.14)",
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  chipTextActive: {
    color: colors.primary,
    fontWeight: "600",
  },
});
