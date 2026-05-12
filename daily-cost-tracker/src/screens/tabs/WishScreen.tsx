import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Keyboard,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppButton } from "../../components/base/AppButton";
import { AppInput } from "../../components/base/AppInput";
import { AppModal } from "../../components/base/AppModal";
import { EmptyState } from "../../components/base/EmptyState";
import { Wish } from "../../domain/models/types";
import { useWishes } from "../../hooks/useWishes";
import { RootStackParamList } from "../../navigation/types";
import { colors } from "../../theme/colors";
import { getShadow, tokens } from "../../theme/tokens";
import { formatMoney } from "../../utils/format";

type FormState = {
  name: string;
  expectPrice: string;
  expectDays: string;
  level: string;
};

const initForm = (): FormState => ({
  name: "",
  expectPrice: "",
  expectDays: "",
  level: "3",
});

export const WishScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { wishes, loading, reload, createOne, updateOne, deleteOne } = useWishes();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingWish, setEditingWish] = useState<Wish | null>(null);
  const [form, setForm] = useState<FormState>(initForm());

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const onOpenCreate = () => {
    setEditingWish(null);
    setForm(initForm());
    setModalVisible(true);
  };

  const onOpenEdit = (wish: Wish) => {
    setEditingWish(wish);
    setForm({
      name: wish.name,
      expectPrice: String(wish.expectPrice ?? 0),
      expectDays: String(wish.expectDays ?? 0),
      level: String(wish.level ?? 3),
    });
    setModalVisible(true);
  };

  const expectDailyPreview = useMemo(() => {
    const price = Number(form.expectPrice);
    const days = Number(form.expectDays);
    if (!Number.isFinite(price) || !Number.isFinite(days) || days <= 0) {
      return null;
    }
    return price / days;
  }, [form.expectPrice, form.expectDays]);

  const onSubmit = async () => {
    const name = form.name.trim();
    const expectPrice = Number(form.expectPrice);
    const expectDays = Number(form.expectDays);
    const level = Number(form.level);

    if (!name) {
      Alert.alert("输入错误", "请输入心愿名称");
      return;
    }
    if (!Number.isFinite(expectPrice) || expectPrice < 0) {
      Alert.alert("输入错误", "预估价格必须为大于等于 0 的数字");
      return;
    }
    if (!Number.isInteger(expectDays) || expectDays <= 0) {
      Alert.alert("输入错误", "目标持有天数必须是大于 0 的整数");
      return;
    }
    if (!Number.isInteger(level) || level < 1 || level > 5) {
      Alert.alert("输入错误", "心仪程度必须在 1-5 之间");
      return;
    }

    if (editingWish) {
      await updateOne(editingWish.id, { name, expectPrice, expectDays, level });
    } else {
      await createOne({ name, expectPrice, expectDays, level });
    }
    Keyboard.dismiss();
    setModalVisible(false);
  };

  const onDelete = (id: number) => {
    Alert.alert("删除确认", "确认删除该心愿吗？", [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: async () => {
          await deleteOne(id);
        },
      },
    ]);
  };

  const onConvert = (wish: Wish) => {
    navigation.navigate("AssetForm", {
      prefill: {
        name: wish.name,
        price: wish.expectPrice ?? 0,
      },
      sourceWishId: wish.id,
    });
  };

  const renderRightActions = (item: Wish) => (
    <View style={styles.actionWrap}>
      <Pressable
        style={({ pressed }) => [styles.actionBtn, styles.actionEdit, pressed && styles.actionPressed]}
        onPress={() => onOpenEdit(item)}
      >
        <Text style={styles.actionText}>编辑</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.actionBtn, styles.actionConvert, pressed && styles.actionPressed]}
        onPress={() => onConvert(item)}
      >
        <Text style={styles.actionText}>转资产</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.actionBtn, styles.actionDelete, pressed && styles.actionPressed]}
        onPress={() => onDelete(item.id)}
      >
        <Text style={styles.actionText}>删除</Text>
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.topBar}>
        <Text style={styles.title}>心愿清单</Text>
        <AppButton title="添加心愿" variant="secondary" onPress={onOpenCreate} />
      </View>

      <FlatList
        data={wishes}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={wishes.length === 0 ? styles.emptyWrap : styles.list}
        renderItem={({ item }) => (
          <Swipeable renderRightActions={() => renderRightActions(item)}>
            <View style={[styles.card, getShadow("sm")]}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>
                预估价格 ¥{formatMoney(item.expectPrice ?? 0)} · 目标 {item.expectDays ?? 0} 天
              </Text>
              <Text style={styles.meta}>
                预估日均 ¥{formatMoney(item.expectDaily ?? 0)} / 天 · 心仪程度 {"★".repeat(item.level ?? 0)}
              </Text>
              <View style={styles.actions}>
                <AppButton title="转为资产" variant="secondary" onPress={() => onConvert(item)} />
              </View>
            </View>
          </Swipeable>
        )}
        ListEmptyComponent={
          <EmptyState title="还没有心愿" description="添加心仪物品，提前核算成本" />
        }
      />

      <AppModal
        visible={modalVisible}
        title={editingWish ? "编辑心愿" : "新增心愿"}
        onClose={() => {
          Keyboard.dismiss();
          setModalVisible(false);
        }}
      >
        <View style={styles.modalContent}>
          <AppInput
            label="心愿名称"
            value={form.name}
            onChangeText={(value) => setForm((prev) => ({ ...prev, name: value }))}
            placeholder="例如 MacBook Pro"
          />
          <AppInput
            label="预估价格"
            value={form.expectPrice}
            onChangeText={(value) => setForm((prev) => ({ ...prev, expectPrice: value }))}
            keyboardType="numeric"
            placeholder="例如 15999"
          />
          <AppInput
            label="目标持有天数"
            value={form.expectDays}
            onChangeText={(value) => setForm((prev) => ({ ...prev, expectDays: value }))}
            keyboardType="numeric"
            placeholder="例如 730"
          />
          <AppInput
            label="心仪程度（1-5）"
            value={form.level}
            onChangeText={(value) => setForm((prev) => ({ ...prev, level: value }))}
            keyboardType="numeric"
            placeholder="默认 3"
          />
          <Text style={styles.previewText}>
            预估日均成本：
            {expectDailyPreview === null ? " —" : ` ¥${formatMoney(expectDailyPreview)} / 天`}
          </Text>
          <AppButton title={editingWish ? "保存修改" : "保存心愿"} onPress={onSubmit} />
        </View>
      </AppModal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: tokens.spacing.sm,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: tokens.spacing.md,
    gap: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: tokens.colors.ocean700,
  },
  list: {
    gap: tokens.spacing.sm + 2,
    paddingBottom: tokens.spacing.xl,
  },
  emptyWrap: {
    flexGrow: 1,
    justifyContent: "center",
  },
  card: {
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderColor: "rgba(94, 132, 216, 0.16)",
    backgroundColor: colors.card,
    padding: 12,
    gap: 6,
  },
  name: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  meta: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  actions: {
    marginTop: 6,
    gap: 8,
  },
  actionWrap: {
    width: 210,
    marginBottom: 10,
    flexDirection: "row",
    borderRadius: tokens.radius.card,
    overflow: "hidden",
  },
  actionBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  actionEdit: {
    backgroundColor: tokens.colors.ocean500,
  },
  actionConvert: {
    backgroundColor: "#4E7CFF",
  },
  actionDelete: {
    backgroundColor: colors.error,
  },
  actionText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  actionPressed: {
    opacity: 0.82,
  },
  modalContent: {
    gap: tokens.spacing.sm + 2,
  },
  previewText: {
    color: colors.textSecondary,
    fontSize: 12,
  },
});
