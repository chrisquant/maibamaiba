import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LineChart } from "../../components/charts/LineChart";
import { Asset } from "../../domain/models/types";
import { useAssets } from "../../hooks/useAssets";
import { RootStackParamList } from "../../navigation/types";
import { colors } from "../../theme/colors";
import { tokens } from "../../theme/tokens";
import { formatDate, formatMoney } from "../../utils/format";

type TimeRange = "all" | "week" | "month" | "year";
type SortField = "dailyCost" | "holdDays" | "price" | "useCount";
type Granularity = "day" | "week" | "month";
type TrendPoint = {
  x: number;
  date: string;
  label: string;
  totalCost: number;
  totalValue: number;
};
type ChartViewport = {
  start: number;
  count: number;
};

const rangeOptions: Array<{ label: string; value: TimeRange }> = [
  { label: "全部", value: "all" },
  { label: "本周", value: "week" },
  { label: "本月", value: "month" },
  { label: "本年", value: "year" },
];

const sortOptions: Array<{ label: string; value: SortField }> = [
  { label: "日均成本", value: "dailyCost" },
  { label: "持有天数", value: "holdDays" },
  { label: "购入价格", value: "price" },
  { label: "使用次数", value: "useCount" },
];

const granularityOptions: Array<{ label: string; value: Granularity }> = [
  { label: "按天", value: "day" },
  { label: "按周", value: "week" },
  { label: "按月", value: "month" },
];

const toDayStart = (value: Date) =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate());

const diffDays = (start: Date, end: Date) =>
  Math.floor((toDayStart(end).getTime() - toDayStart(start).getTime()) / (1000 * 60 * 60 * 24));

const getWeekStart = (value: Date) => {
  const day = value.getDay();
  const offset = day === 0 ? 6 : day - 1;
  return new Date(value.getFullYear(), value.getMonth(), value.getDate() - offset);
};

const getMonthStart = (value: Date) => new Date(value.getFullYear(), value.getMonth(), 1);

const getRangeStart = (range: TimeRange) => {
  const now = new Date();
  const today = toDayStart(now);
  if (range === "all") {
    return null;
  }
  if (range === "week") {
    return getWeekStart(today);
  }
  if (range === "month") {
    return getMonthStart(today);
  }
  return new Date(today.getFullYear(), 0, 1);
};

const inSelectedRange = (asset: Asset, range: TimeRange) => {
  const start = getRangeStart(range);
  if (!start) {
    return true;
  }
  const buy = new Date(asset.buyTime);
  return !Number.isNaN(buy.getTime()) && buy.getTime() >= start.getTime();
};

const getSeriesStart = (assets: Asset[], range: TimeRange) => {
  const rangeStart = getRangeStart(range);
  if (rangeStart) {
    return toDayStart(rangeStart);
  }
  const minBuy = assets
    .map((item) => new Date(item.buyTime))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime())[0];
  return minBuy ? toDayStart(minBuy) : toDayStart(new Date());
};

const buildTimeline = (start: Date, end: Date, granularity: Granularity) => {
  const result: Date[] = [];
  if (granularity === "day") {
    let current = toDayStart(start);
    while (current.getTime() <= end.getTime()) {
      result.push(current);
      current = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 1);
    }
    return result;
  }
  if (granularity === "week") {
    let current = getWeekStart(start);
    while (current.getTime() <= end.getTime()) {
      result.push(current);
      current = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 7);
    }
    return result;
  }
  let current = getMonthStart(start);
  while (current.getTime() <= end.getTime()) {
    result.push(current);
    current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
  }
  return result;
};

const calcPointMetrics = (assets: Asset[], pointDate: Date) => {
  let totalValue = 0;
  let totalCost = 0;

  for (const item of assets) {
    const buyDate = new Date(item.buyTime);
    if (Number.isNaN(buyDate.getTime()) || buyDate.getTime() > pointDate.getTime()) {
      continue;
    }
    const baseCost = item.price + item.addFee;
    totalValue += baseCost;

    const daysFromBuy = diffDays(buyDate, pointDate);
    if (daysFromBuy <= 0) {
      continue;
    }
    if (item.status !== 0 && item.deactivatedAt) {
      const stopDate = new Date(item.deactivatedAt);
      if (!Number.isNaN(stopDate.getTime()) && pointDate.getTime() > stopDate.getTime()) {
        continue;
      }
    }

    const effectiveDays = Math.max(1, daysFromBuy);
    totalCost += baseCost / effectiveDays;
  }

  return { totalValue, totalCost };
};

const buildTimeLabel = (date: Date, granularity: Granularity) => {
  const key = formatDate(date);
  if (granularity === "day") {
    return key.slice(5);
  }
  if (granularity === "week") {
    return `W${key.slice(5)}`;
  }
  return key.slice(0, 7);
};

const MIN_VISIBLE_POINTS = 14;
const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);
const getMinVisibleCount = (totalPoints: number) => Math.min(totalPoints, MIN_VISIBLE_POINTS);

const getTrendSeries = (assets: Asset[], range: TimeRange, granularity: Granularity) => {
  const today = toDayStart(new Date());
  const start = getSeriesStart(assets, range);
  const timeline = buildTimeline(start, today, granularity);
  const raw = timeline.map((date, index) => {
    const metrics = calcPointMetrics(assets, date);
    return {
      x: index + 1,
      date: formatDate(date),
      label: buildTimeLabel(date, granularity),
      totalValue: metrics.totalValue,
      totalCost: metrics.totalCost,
    };
  });
  return raw;
};

export const StatsScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { assets, loading, reload } = useAssets();
  const [range, setRange] = useState<TimeRange>("all");
  const [granularity, setGranularity] = useState<Granularity>("week");
  const [sortField, setSortField] = useState<SortField>("dailyCost");
  const [asc, setAsc] = useState(false);
  const [chartViewport, setChartViewport] = useState<ChartViewport | null>(null);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const rangeAssets = useMemo(
    () => assets.filter((item) => inSelectedRange(item, range)),
    [assets, range],
  );

  const summary = useMemo(() => {
    const totalBuy = rangeAssets.reduce((sum, item) => sum + item.price, 0);
    const totalAddFee = rangeAssets.reduce((sum, item) => sum + item.addFee, 0);
    const totalSell = rangeAssets.reduce((sum, item) => sum + item.sellPrice, 0);
    const netSpend = totalBuy + totalAddFee - totalSell;
    return {
      totalBuy,
      totalAddFee,
      totalSell,
      netSpend,
      count: rangeAssets.length,
    };
  }, [rangeAssets]);

  const categoryRatios = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of rangeAssets) {
      const key = item.category || "未分类";
      const current = map.get(key) ?? 0;
      map.set(key, current + item.price + item.addFee);
    }
    const total = Array.from(map.values()).reduce((sum, value) => sum + value, 0);
    return Array.from(map.entries())
      .map(([name, value]) => ({
        name,
        value,
        ratio: total > 0 ? value / total : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [rangeAssets]);

  const trendData = useMemo(
    () => getTrendSeries(rangeAssets, range, granularity),
    [granularity, range, rangeAssets],
  );
  const visibleTrendData = useMemo(() => {
    if (!chartViewport) {
      return trendData;
    }
    const end = chartViewport.start + chartViewport.count;
    return trendData.slice(chartViewport.start, end);
  }, [chartViewport, trendData]);

  useEffect(() => {
    if (trendData.length === 0) {
      setChartViewport(null);
      return;
    }
    setChartViewport((prev) => {
      if (!prev) {
        return { start: 0, count: trendData.length };
      }
      const minCount = getMinVisibleCount(trendData.length);
      const nextCount = clamp(prev.count, minCount, trendData.length);
      const maxStart = Math.max(0, trendData.length - nextCount);
      return {
        start: clamp(prev.start, 0, maxStart),
        count: nextCount,
      };
    });
  }, [trendData.length]);

  const sortedAssets = useMemo(() => {
    const sorted = [...rangeAssets].sort((a, b) => {
      const left = a[sortField];
      const right = b[sortField];
      if (left === right) {
        return 0;
      }
      return left > right ? 1 : -1;
    });
    return asc ? sorted : sorted.reverse();
  }, [rangeAssets, sortField, asc]);

  const handleChartPan = useCallback((deltaX: number, chartWidth: number) => {
    if (trendData.length < 2 || chartWidth <= 0) {
      return;
    }
    setChartViewport((prev) => {
      if (!prev) {
        return prev;
      }
      const maxStart = trendData.length - prev.count;
      if (maxStart <= 0) {
        return prev;
      }
      const pointsPerPx = (prev.count - 1) / chartWidth;
      const deltaPoints = Math.round((-deltaX) * pointsPerPx);
      if (deltaPoints === 0) {
        return prev;
      }
      const nextStart = clamp(prev.start + deltaPoints, 0, maxStart);
      if (nextStart === prev.start) {
        return prev;
      }
      return { ...prev, start: nextStart };
    });
  }, [trendData.length]);

  const handleChartPinch = useCallback(
    (scaleDelta: number, focalX: number, chartWidth: number) => {
      if (trendData.length < 2 || chartWidth <= 0 || !Number.isFinite(scaleDelta) || scaleDelta <= 0) {
        return;
      }
      setChartViewport((prev) => {
        if (!prev) {
          return prev;
        }
        const minCount = getMinVisibleCount(trendData.length);
        const ratio = clamp(focalX / chartWidth, 0, 1);
        const nextCount = clamp(
          Math.round(prev.count / scaleDelta),
          minCount,
          trendData.length,
        );
        if (nextCount === prev.count) {
          return prev;
        }
        const anchorIndex = prev.start + ratio * (prev.count - 1);
        const maxStart = trendData.length - nextCount;
        const nextStart = clamp(
          Math.round(anchorIndex - ratio * (nextCount - 1)),
          0,
          maxStart,
        );
        return { start: nextStart, count: nextCount };
      });
    },
    [trendData.length],
  );

  const header = (
    <View>
      <Text style={styles.title}>数据统计</Text>

      <View style={styles.rangeWrap}>
        {rangeOptions.map((item) => (
          <Pressable
            key={item.value}
            onPress={() => setRange(item.value)}
            style={[styles.rangeChip, range === item.value ? styles.rangeChipActive : undefined]}
          >
            <Text
              style={[
                styles.rangeText,
                range === item.value ? styles.rangeTextActive : undefined,
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.granularityWrap}>
        {granularityOptions.map((item) => (
          <Pressable
            key={item.value}
            onPress={() => setGranularity(item.value)}
            style={[
              styles.granularityChip,
              granularity === item.value ? styles.granularityChipActive : undefined,
            ]}
          >
            <Text
              style={[
                styles.granularityText,
                granularity === item.value ? styles.granularityTextActive : undefined,
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>总购入金额</Text>
          <Text style={styles.summaryValue}>¥{formatMoney(summary.totalBuy)}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>总附加费用</Text>
          <Text style={styles.summaryValue}>¥{formatMoney(summary.totalAddFee)}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>总卖出残值</Text>
          <Text style={styles.summaryValue}>¥{formatMoney(summary.totalSell)}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>净总支出</Text>
          <Text style={styles.summaryValue}>¥{formatMoney(summary.netSpend)}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>物品总数</Text>
          <Text style={styles.summaryValue}>{summary.count}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>趋势图（单指拖拽平移 / 双指缩放比例）</Text>
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>资产总额趋势</Text>
        <LineChart
          data={visibleTrendData.map((item) => ({ label: item.label, value: item.totalValue }))}
          color={tokens.colors.ocean500}
          emptyText="数据点不足，暂无法绘制资产总额折线图"
          onPinchScale={handleChartPinch}
          onPanDelta={handleChartPan}
        />
      </View>

      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>日均成本趋势</Text>
        <LineChart
          data={visibleTrendData.map((item) => ({ label: item.label, value: item.totalCost }))}
          color={tokens.colors.accentMint400}
          emptyText="数据点不足，暂无法绘制日均成本折线图"
          onPinchScale={handleChartPinch}
          onPanDelta={handleChartPan}
        />
      </View>

      <Text style={styles.sectionTitle}>分类占比（按金额）</Text>
      <View style={styles.ratioCard}>
        {categoryRatios.length === 0 ? (
          <Text style={styles.emptyText}>当前时间范围无数据</Text>
        ) : (
          categoryRatios.slice(0, 6).map((item) => (
            <View key={item.name} style={styles.ratioRow}>
              <Text style={styles.ratioLabel}>{item.name}</Text>
              <View style={styles.ratioBarTrack}>
                <View style={[styles.ratioBarFill, { width: `${item.ratio * 100}%` }]} />
              </View>
              <Text style={styles.ratioValue}>{Math.round(item.ratio * 100)}%</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.sortHeader}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortWrap}>
          {sortOptions.map((item) => (
            <Pressable
              key={item.value}
              onPress={() => setSortField(item.value)}
              style={[styles.sortChip, sortField === item.value ? styles.sortChipActive : undefined]}
            >
              <Text
                style={[
                  styles.sortText,
                  sortField === item.value ? styles.sortTextActive : undefined,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <Pressable style={styles.orderBtn} onPress={() => setAsc((value) => !value)}>
          <Text style={styles.orderBtnText}>{asc ? "升序" : "降序"}</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <FlatList
        data={sortedAssets}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
        ListHeaderComponent={header}
        contentContainerStyle={styles.listContainer}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.itemCard, pressed ? styles.itemPressed : undefined]}
            onPress={() => navigation.navigate("AssetDetail", { assetId: item.id })}
          >
            <View>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemMeta}>
                {item.category || "未分类"} · 持有 {item.holdDays} 天 · 使用 {item.useCount} 次
              </Text>
            </View>
            <Text style={styles.itemCost}>
              {item.holdDays === 0 ? "—" : `¥${formatMoney(item.dailyCost)}/天`}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>当前时间范围无资产</Text>}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContainer: {
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.lg,
    paddingBottom: 28,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: tokens.colors.ocean700,
  },
  rangeWrap: {
    flexDirection: "row",
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.sm,
    marginBottom: tokens.spacing.sm,
  },
  rangeChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: tokens.radius.chip,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  rangeChipActive: {
    borderColor: colors.primary,
    backgroundColor: "rgba(78, 124, 255, 0.14)",
  },
  rangeText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  rangeTextActive: {
    color: colors.primary,
    fontWeight: "600",
  },
  granularityWrap: {
    flexDirection: "row",
    gap: tokens.spacing.sm,
    marginBottom: tokens.spacing.sm,
  },
  granularityChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: tokens.radius.chip,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  granularityChipActive: {
    borderColor: colors.primary,
    backgroundColor: "rgba(78, 124, 255, 0.14)",
  },
  granularityText: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  granularityTextActive: {
    color: colors.primary,
    fontWeight: "600",
  },
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderColor: "rgba(94, 132, 216, 0.16)",
    padding: 12,
    gap: 8,
    marginBottom: 12,
  },
  summaryItem: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryLabel: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  summaryValue: {
    color: tokens.colors.ocean700,
    fontWeight: "700",
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 8,
  },
  ratioCard: {
    backgroundColor: colors.card,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderColor: "rgba(94, 132, 216, 0.16)",
    padding: 12,
    gap: 8,
    marginBottom: 12,
  },
  chartCard: {
    backgroundColor: colors.card,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderColor: "rgba(94, 132, 216, 0.16)",
    paddingHorizontal: 8,
    paddingTop: 10,
    marginBottom: 12,
  },
  chartTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
    paddingHorizontal: 8,
  },
  ratioRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ratioLabel: {
    width: 56,
    color: colors.textSecondary,
    fontSize: 12,
  },
  ratioBarTrack: {
    flex: 1,
    height: 8,
    borderRadius: tokens.radius.chip,
    backgroundColor: tokens.colors.neutral100,
    overflow: "hidden",
  },
  ratioBarFill: {
    height: 8,
    borderRadius: tokens.radius.chip,
    backgroundColor: colors.primary,
  },
  ratioValue: {
    width: 34,
    textAlign: "right",
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: "600",
  },
  sortHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  sortWrap: {
    gap: 8,
    paddingRight: 4,
  },
  sortChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: tokens.radius.chip,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  sortChipActive: {
    borderColor: colors.primary,
    backgroundColor: "rgba(78, 124, 255, 0.14)",
  },
  sortText: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  sortTextActive: {
    color: colors.primary,
    fontWeight: "600",
  },
  orderBtn: {
    borderRadius: tokens.radius.chip,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  orderBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  itemCard: {
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderColor: "rgba(94, 132, 216, 0.16)",
    backgroundColor: colors.card,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 8,
  },
  itemPressed: {
    opacity: 0.82,
  },
  itemName: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  itemMeta: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: 12,
  },
  itemCost: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
  },
  emptyText: {
    fontSize: 13,
    color: colors.textSecondary,
    paddingVertical: 8,
  },
});
