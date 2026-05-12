import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Alert,
  Keyboard,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import DraggableFlatList, { RenderItemParams } from "react-native-draggable-flatlist";
import { Swipeable } from "react-native-gesture-handler";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppButton } from "../../components/base/AppButton";
import { EmptyState } from "../../components/base/EmptyState";
import { AppModal } from "../../components/base/AppModal";
import { getCategories } from "../../db/categoryRepository";
import { Category } from "../../domain/models/types";
import { useAssets } from "../../hooks/useAssets";
import { RootStackParamList } from "../../navigation/types";
import { colors } from "../../theme/colors";
import { getShadow, tokens } from "../../theme/tokens";
import { formatMoney } from "../../utils/format";

const statusItems: Array<{ label: string; value: 0 | 1 | 2 | 3 }> = [
  { label: "服役中", value: 0 },
  { label: "已停用", value: 1 },
  { label: "已卖出", value: 2 },
  { label: "报废丢失", value: 3 },
];

const statusMeta: Record<0 | 1 | 2 | 3, { label: string; color: string; bg: string }> = {
  0: { label: "服役中", color: "#166534", bg: "#DCFCE7" },
  1: { label: "已停用", color: "#1D4ED8", bg: "#DBEAFE" },
  2: { label: "已卖出", color: "#7C2D12", bg: "#FFE7D1" },
  3: { label: "报废丢失", color: "#991B1B", bg: "#FEE2E2" },
};

type SortMode =
  | "custom"
  | "buyTimeDesc"
  | "buyTimeAsc"
  | "dailyCostDesc"
  | "dailyCostAsc"
  | "priceDesc"
  | "priceAsc";

const sortOptions: Array<{ value: SortMode; label: string }> = [
  { value: "custom", label: "自定义排序（拖拽）" },
  { value: "buyTimeDesc", label: "按购入时间（新 -> 旧）" },
  { value: "buyTimeAsc", label: "按购入时间（旧 -> 新）" },
  { value: "dailyCostDesc", label: "按日均成本（高 -> 低）" },
  { value: "dailyCostAsc", label: "按日均成本（低 -> 高）" },
  { value: "priceDesc", label: "按资产价格（高 -> 低）" },
  { value: "priceAsc", label: "按资产价格（低 -> 高）" },
];

export const HomeScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { assets, loading, reload, deleteOne, updateStatus, reorder } = useAssets();
  const [searchText, setSearchText] = useState("");
  const [categories, setCategories] = useState<Array<Pick<Category, "id" | "name" | "icon">>>([]);
  const [selectedCategory, setSelectedCategory] = useState("全部");
  const [sortMode, setSortMode] = useState<SortMode>("custom");
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [showSearchInput, setShowSearchInput] = useState(false);
  const searchInputRef = useRef<TextInput | null>(null);
  const heroOpacity = useSharedValue(0);
  const heroTranslateY = useSharedValue(10);

  const loadAll = useCallback(async () => {
    await reload();
    const allCategories = await getCategories();
    setCategories([
      { id: 0, name: "全部", icon: null },
      ...allCategories.map((item) => ({ id: item.id, name: item.name, icon: item.icon })),
    ]);
  }, [reload]);

  useFocusEffect(
    useCallback(() => {
      void loadAll();
    }, [loadAll]),
  );

  useEffect(() => {
    heroOpacity.value = withTiming(1, {
      duration: tokens.motion.duration.normal,
      easing: Easing.bezier(...tokens.motion.easing.oceanEaseOut),
    });
    heroTranslateY.value = withTiming(0, {
      duration: tokens.motion.duration.normal,
      easing: Easing.bezier(...tokens.motion.easing.oceanEaseOut),
    });
  }, [heroOpacity, heroTranslateY]);

  const heroAnimatedStyle = useAnimatedStyle(() => ({
    opacity: heroOpacity.value,
    transform: [{ translateY: heroTranslateY.value }],
  }));

  const filteredAssets = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    return assets.filter((item) => {
      const matchCategory =
        selectedCategory === "全部" ? true : item.category === selectedCategory;
      const matchKeyword =
        keyword.length === 0
          ? true
          : item.name.toLowerCase().includes(keyword) ||
            (item.category ?? "").toLowerCase().includes(keyword);
      return matchCategory && matchKeyword;
    });
  }, [assets, searchText, selectedCategory]);

  const sortedAssets = useMemo(() => {
    const list = [...filteredAssets];
    if (sortMode === "custom") {
      return list;
    }
    if (sortMode === "buyTimeDesc") {
      return list.sort((a, b) => b.buyTime.localeCompare(a.buyTime));
    }
    if (sortMode === "buyTimeAsc") {
      return list.sort((a, b) => a.buyTime.localeCompare(b.buyTime));
    }
    if (sortMode === "dailyCostDesc") {
      return list.sort((a, b) => b.dailyCost - a.dailyCost);
    }
    if (sortMode === "dailyCostAsc") {
      return list.sort((a, b) => a.dailyCost - b.dailyCost);
    }
    if (sortMode === "priceDesc") {
      return list.sort((a, b) => b.price - a.price);
    }
    return list.sort((a, b) => a.price - b.price);
  }, [filteredAssets, sortMode]);

  const summary = useMemo(() => {
    const totalValue = assets.reduce((sum, item) => sum + item.price + item.addFee, 0);
    const totalDaily = assets
      .filter((item) => item.holdDays > 0)
      .reduce((sum, item) => sum + item.dailyCost, 0);
    return {
      totalValue,
      totalDaily,
      totalCount: assets.length,
    };
  }, [assets]);

  const showStatusMenu = (assetId: number) => {
    Alert.alert("修改状态", "请选择新的资产状态", [
      ...statusItems.map((item) => ({
        text: item.label,
        onPress: async () => {
          await updateStatus(assetId, item.value);
        },
      })),
      { text: "取消", style: "cancel" },
    ]);
  };

  const onDelete = (assetId: number) => {
    Alert.alert("删除确认", "删除后不可恢复，确认删除吗？", [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: async () => {
          await deleteOne(assetId);
        },
      },
    ]);
  };

  const renderRightActions = (assetId: number) => (
    <View style={styles.actionWrap}>
      <Pressable
        style={({ pressed }) => [styles.actionBtn, styles.actionEdit, pressed && styles.actionPressed]}
        onPress={() => navigation.navigate("AssetForm", { assetId })}
      >
        <Text style={styles.actionText}>编辑</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.actionBtn, styles.actionStatus, pressed && styles.actionPressed]}
        onPress={() => showStatusMenu(assetId)}
      >
        <Text style={styles.actionText}>状态</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.actionBtn, styles.actionDelete, pressed && styles.actionPressed]}
        onPress={() => onDelete(assetId)}
      >
        <Text style={styles.actionText}>删除</Text>
      </Pressable>
    </View>
  );

  const handleDragEnd = async ({ data }: { data: typeof sortedAssets }) => {
    if (sortMode !== "custom") {
      return;
    }
    const visibleIdSet = new Set(data.map((item) => item.id));
    let pointer = 0;
    const merged = assets.map((item) => {
      if (visibleIdSet.has(item.id)) {
        const nextItem = data[pointer];
        pointer += 1;
        return nextItem;
      }
      return item;
    });
    await reorder(merged.map((item) => item.id));
  };

  const toggleSearchInput = useCallback(() => {
    setShowSearchInput((prev) => {
      const next = !prev;
      if (next) {
        requestAnimationFrame(() => {
          searchInputRef.current?.focus();
        });
      } else if (searchText.trim().length === 0) {
        setSearchText("");
      }
      return next;
    });
  }, [searchText]);

  const renderAssetCard = (item: (typeof sortedAssets)[number], drag?: () => void, isActive?: boolean) => (
    <Swipeable renderRightActions={() => renderRightActions(item.id)}>
      <Pressable
        style={({ pressed }) => [
          styles.card,
          pressed ? styles.cardPressed : undefined,
          isActive ? styles.cardActive : undefined,
        ]}
        onPress={() => navigation.navigate("AssetDetail", { assetId: item.id })}
        onLongPress={sortMode === "custom" ? drag : undefined}
      >
        <View style={styles.cardLeft}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {item.name}
            </Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: statusMeta[item.status].bg },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  { color: statusMeta[item.status].color },
                ]}
              >
                {statusMeta[item.status].label}
              </Text>
            </View>
          </View>
          <Text style={styles.meta}>
            {(item.category || "未分类") +
              " · " +
              `¥${formatMoney(item.price + item.addFee)}` +
              " · " +
              item.buyTime +
              " · " +
              `${item.holdDays} 天`}
          </Text>
        </View>
        <Text style={styles.price}>
          {item.holdDays === 0 ? "—" : `¥${formatMoney(item.dailyCost)}/天`}
        </Text>
      </Pressable>
    </Swipeable>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Animated.View style={[styles.heroCard, getShadow("md"), heroAnimatedStyle]}>
        <LinearGradient
          colors={["#E7EEFF", "#E8FBF5", "#FFF7E8"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroGradient}
        />
        <View style={styles.topBar}>
          <Text style={styles.title}>资产首页</Text>
          <AppButton
            title="新增资产"
            variant="secondary"
            onPress={() => navigation.navigate("AssetForm")}
          />
        </View>
        <Pressable style={styles.summaryCard} onPress={Keyboard.dismiss}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>总资产金额</Text>
            <Text style={styles.summaryValue}>¥{formatMoney(summary.totalValue)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>总日均成本</Text>
            <Text style={styles.summaryValue}>¥{formatMoney(summary.totalDaily)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>资产数量</Text>
            <Text style={styles.summaryValue}>{summary.totalCount}</Text>
          </View>
        </Pressable>
      </Animated.View>
      <View style={styles.categoryRow}>
        {showSearchInput ? (
          <View style={styles.inlineSearchWrap}>
            <TextInput
              ref={searchInputRef}
              style={styles.inlineSearchInput}
              value={searchText}
              onChangeText={setSearchText}
              placeholder="搜索名称或分类"
              placeholderTextColor={colors.textSecondary}
              returnKeyType="search"
              onBlur={() => {
                if (searchText.trim().length === 0) {
                  setShowSearchInput(false);
                }
              }}
            />
            <Pressable
              style={styles.searchCloseTrigger}
              onPress={() => {
                if (searchText.trim().length === 0) {
                  setShowSearchInput(false);
                } else {
                  setSearchText("");
                }
              }}
            >
              <Ionicons name="close-outline" size={16} color={colors.primary} />
            </Pressable>
          </View>
        ) : (
          <>
            <ScrollView
              style={styles.categoryScroll}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryBar}
            >
              {categories.map((category) => (
                <Pressable
                  key={category.id}
                  onPress={() => setSelectedCategory(category.name)}
                  style={[
                    styles.categoryChip,
                    selectedCategory === category.name ? styles.categoryChipActive : undefined,
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.categoryText,
                      selectedCategory === category.name ? styles.categoryTextActive : undefined,
                    ]}
                  >
                    {category.icon ? `${category.icon} ` : ""}
                    {category.name}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                style={styles.categoryAddChip}
                onPress={() => navigation.navigate("CategoryManage")}
              >
                <Text style={styles.categoryAddText}>＋</Text>
              </Pressable>
            </ScrollView>
            <View style={styles.rowActionGroup}>
              <Pressable style={styles.searchTrigger} onPress={toggleSearchInput}>
                <Ionicons name="search-outline" size={16} color={colors.primary} />
              </Pressable>
              <Pressable style={styles.sortTrigger} onPress={() => setSortModalVisible(true)}>
                <Ionicons name="swap-vertical-outline" size={16} color={colors.primary} />
              </Pressable>
            </View>
          </>
        )}
      </View>

      {sortMode === "custom" ? (
        <DraggableFlatList
          data={sortedAssets}
          keyExtractor={(item) => String(item.id)}
          onRefresh={loadAll}
          refreshing={loading}
          contentContainerStyle={sortedAssets.length === 0 ? styles.listEmpty : styles.list}
          onDragEnd={handleDragEnd}
          renderItem={({ item, drag, isActive }: RenderItemParams<(typeof sortedAssets)[number]>) =>
            renderAssetCard(item, drag, isActive)
          }
          ListEmptyComponent={
            <EmptyState
              title="还没有资产"
              description="点击上方新增资产开始记录"
            />
          }
        />
      ) : (
        <FlatList
          data={sortedAssets}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={sortedAssets.length === 0 ? styles.listEmpty : styles.list}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={loadAll} />}
          renderItem={({ item }) => renderAssetCard(item)}
          ListEmptyComponent={
            <EmptyState
              title="还没有资产"
              description="点击上方新增资产开始记录"
            />
          }
        />
      )}

      <AppModal
        visible={sortModalVisible}
        title="排序方式"
        onClose={() => setSortModalVisible(false)}
      >
        <View style={styles.sortOptionsWrap}>
          {sortOptions.map((option) => (
            <Pressable
              key={option.value}
              style={[
                styles.sortOption,
                sortMode === option.value ? styles.sortOptionActive : undefined,
              ]}
              onPress={() => {
                setSortMode(option.value);
                setSortModalVisible(false);
              }}
            >
              <Text
                style={[
                  styles.sortOptionText,
                  sortMode === option.value ? styles.sortOptionTextActive : undefined,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
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
  heroCard: {
    position: "relative",
    borderRadius: tokens.radius.cardLarge,
    overflow: "hidden",
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(78, 124, 255, 0.16)",
    backgroundColor: colors.card,
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: tokens.spacing.sm,
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: tokens.colors.ocean700,
  },
  categoryBar: {
    alignItems: "center",
    paddingBottom: tokens.spacing.sm,
    gap: tokens.spacing.sm,
  },
  categoryScroll: {
    maxHeight: 42,
    flex: 1,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
    marginBottom: tokens.spacing.xs,
  },
  summaryCard: {
    backgroundColor: "rgba(255, 255, 255, 0.78)",
    borderWidth: 1,
    borderColor: "rgba(94, 132, 216, 0.18)",
    borderRadius: tokens.radius.card,
    paddingVertical: tokens.spacing.sm,
    flexDirection: "row",
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  summaryLabel: {
    color: colors.textSecondary,
    fontSize: 10,
  },
  summaryValue: {
    color: tokens.colors.ocean700,
    fontSize: 13,
    fontWeight: "700",
  },
  categoryChip: {
    minHeight: 30,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 0,
    borderRadius: tokens.radius.chip,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
  },
  categoryChipActive: {
    backgroundColor: "rgba(78, 124, 255, 0.14)",
    borderColor: colors.primary,
  },
  categoryAddChip: {
    minHeight: 30,
    minWidth: 30,
    paddingHorizontal: tokens.spacing.sm,
    borderRadius: tokens.radius.chip,
    borderWidth: 1,
    borderColor: "rgba(94, 132, 216, 0.32)",
    backgroundColor: "rgba(78, 124, 255, 0.08)",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
  },
  categoryAddText: {
    color: colors.primary,
    fontSize: 16,
    lineHeight: 18,
    fontWeight: "700",
  },
  sortTrigger: {
    width: 34,
    height: 30,
    borderRadius: tokens.radius.chip,
    borderWidth: 1,
    borderColor: "rgba(94, 132, 216, 0.32)",
    backgroundColor: "rgba(78, 124, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: -6,
  },
  searchTrigger: {
    width: 34,
    height: 30,
    borderRadius: tokens.radius.chip,
    borderWidth: 1,
    borderColor: "rgba(94, 132, 216, 0.32)",
    backgroundColor: "rgba(78, 124, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: -3,
  },
  rowActionGroup: {
    flexDirection: "row",
    gap: tokens.spacing.xs,
    alignItems: "center",
  },
  inlineSearchWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.xs,
  },
  inlineSearchInput: {
    flex: 1,
    height: 30,
    borderWidth: 1,
    borderColor: "rgba(94, 132, 216, 0.28)",
    borderRadius: tokens.radius.chip,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    color: colors.textPrimary,
    fontSize: 13,
  },
  searchCloseTrigger: {
    width: 34,
    height: 30,
    borderRadius: tokens.radius.chip,
    borderWidth: 1,
    borderColor: "rgba(94, 132, 216, 0.32)",
    backgroundColor: "rgba(78, 124, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: -6,
  },
  categoryText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 16,
    includeFontPadding: false,
  },
  categoryTextActive: {
    color: colors.primary,
    fontWeight: "600",
  },
  list: {
    gap: 10,
    paddingBottom: tokens.spacing.xl,
  },
  listEmpty: {
    flexGrow: 1,
    justifyContent: "center",
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderColor: "rgba(94, 132, 216, 0.16)",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  cardPressed: {
    opacity: 0.85,
  },
  cardActive: {
    opacity: 0.9,
  },
  cardLeft: {
    flex: 1,
    gap: 5,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  name: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
    marginRight: 6,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    flexShrink: 0,
    alignSelf: "flex-start",
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
    includeFontPadding: false,
  },
  meta: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  price: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "700",
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
  actionStatus: {
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
    opacity: 0.8,
  },
  sortOptionsWrap: {
    gap: tokens.spacing.sm,
  },
  sortOption: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: tokens.radius.button,
    backgroundColor: colors.card,
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
  },
  sortOptionActive: {
    borderColor: colors.primary,
    backgroundColor: "rgba(78, 124, 255, 0.12)",
  },
  sortOptionText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  sortOptionTextActive: {
    color: colors.primary,
    fontWeight: "600",
  },
});
