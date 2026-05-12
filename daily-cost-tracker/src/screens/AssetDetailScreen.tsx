import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppButton } from "../components/base/AppButton";
import { AppCard } from "../components/base/AppCard";
import { AppInput } from "../components/base/AppInput";
import { AppModal } from "../components/base/AppModal";
import { getAddFeeItemsByAsset } from "../db/addFeeRepository";
import { AddFeeItem, Asset } from "../domain/models/types";
import { calcSingleUseCost } from "../domain/calculators/costCalculator";
import { useAssets } from "../hooks/useAssets";
import { RootStackParamList } from "../navigation/types";
import { colors } from "../theme/colors";
import { formatMoney } from "../utils/format";

type Props = NativeStackScreenProps<RootStackParamList, "AssetDetail">;

const statusMap: Record<number, string> = {
  0: "服役中",
  1: "已停用",
  2: "已卖出",
  3: "报废丢失",
};

const statusColorMap: Record<number, string> = {
  0: "#16a34a",
  1: "#2563eb",
  2: "#ea580c",
  3: "#dc2626",
};

const detailRow = (label: string, value: string) => (
  <View style={styles.row} key={label}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue}>{value}</Text>
  </View>
);

export const AssetDetailScreen = ({ navigation, route }: Props) => {
  const { getAssetById, deleteOne, addFee, updateUseCount, updateStatus } = useAssets();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [addFeeItems, setAddFeeItems] = useState<AddFeeItem[]>([]);
  const [feeModalVisible, setFeeModalVisible] = useState(false);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [useCountModalVisible, setUseCountModalVisible] = useState(false);
  const [feeAmount, setFeeAmount] = useState("");
  const [feeRemark, setFeeRemark] = useState("");
  const [nextUseCount, setNextUseCount] = useState("");

  const loadDetail = useCallback(async () => {
    const [one, feeItems] = await Promise.all([
      getAssetById(route.params.assetId),
      getAddFeeItemsByAsset(route.params.assetId),
    ]);
    setAsset(one);
    setAddFeeItems(feeItems);
  }, [getAssetById, route.params.assetId]);

  useFocusEffect(
    useCallback(() => {
      void loadDetail();
    }, [loadDetail]),
  );

  const onDelete = () => {
    Alert.alert("删除确认", "删除后不可恢复，确认删除吗？", [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: async () => {
          if (!asset) {
            return;
          }
          await deleteOne(asset.id);
          navigation.goBack();
        },
      },
    ]);
  };

  const onAddFee = async () => {
    if (!asset) {
      return;
    }
    const amount = Number(feeAmount);
    if (!Number.isFinite(amount)) {
      Alert.alert("输入错误", "请输入有效的金额");
      return;
    }
    await addFee(asset.id, amount, feeRemark.trim() || null);
    setFeeAmount("");
    setFeeRemark("");
    setFeeModalVisible(false);
    await loadDetail();
  };

  const onSaveUseCount = async () => {
    if (!asset) {
      return;
    }
    const value = Number(nextUseCount);
    if (!Number.isInteger(value) || value < 0) {
      Alert.alert("输入错误", "使用次数必须是大于等于 0 的整数");
      return;
    }
    await updateUseCount(asset.id, value);
    setUseCountModalVisible(false);
    await loadDetail();
  };

  const onChangeStatus = async (status: 0 | 1 | 2 | 3) => {
    if (!asset) {
      return;
    }
    await updateStatus(asset.id, status);
    setStatusModalVisible(false);
    await loadDetail();
  };

  if (!asset) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>未找到资产数据</Text>
      </View>
    );
  }

  const singleUseCost = calcSingleUseCost({
    price: asset.price,
    addFee: asset.addFee,
    holdDays: asset.holdDays,
    useCount: asset.useCount,
  });
  const netCost = asset.price + asset.addFee - asset.sellPrice;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{asset.name}</Text>
      <Text style={[styles.subtitle, { color: statusColorMap[asset.status] }]}>
        {statusMap[asset.status]}
      </Text>

      <AppCard>
        {detailRow("购入价格", `¥${formatMoney(asset.price)}`)}
        {detailRow("附加费用", `¥${formatMoney(asset.addFee)}`)}
        {detailRow("卖出残值", `¥${formatMoney(asset.sellPrice)}`)}
        {detailRow("净成本", `¥${formatMoney(netCost)}`)}
        {detailRow("持有天数", String(asset.holdDays))}
        {detailRow("日均成本", asset.holdDays === 0 ? "—" : `¥${formatMoney(asset.dailyCost)}`)}
        {detailRow("使用次数", String(asset.useCount))}
        {detailRow("单次成本", singleUseCost === null ? "—" : `¥${formatMoney(singleUseCost)}`)}
        {detailRow("购买日期", asset.buyTime)}
        {detailRow("停用日期", asset.deactivatedAt || "—")}
        {detailRow("分类", asset.category ?? "未分类")}
        {detailRow("备注", asset.remark || "—")}
      </AppCard>

      <AppCard>
        <Text style={styles.sectionTitle}>附加费用明细</Text>
        {addFeeItems.length === 0 ? (
          <Text style={styles.emptyFeeText}>暂无附加费用记录</Text>
        ) : (
          addFeeItems.map((item) => (
            <View style={styles.row} key={item.id}>
              <Text style={styles.rowLabel}>
                {item.remark?.trim() || "未备注"}
                {item.createdAt ? ` · ${item.createdAt.slice(0, 10)}` : ""}
              </Text>
              <Text style={styles.rowValue}>¥{formatMoney(item.amount)}</Text>
            </View>
          ))
        )}
      </AppCard>

      <View style={styles.buttonRow}>
        <AppButton
          title="编辑"
          variant="secondary"
          onPress={() => navigation.navigate("AssetForm", { assetId: asset.id })}
        />
        <AppButton
          title="加附加费"
          variant="secondary"
          onPress={() => setFeeModalVisible(true)}
        />
        <AppButton
          title="记使用次数"
          variant="secondary"
          onPress={() => {
            setNextUseCount(String(asset.useCount));
            setUseCountModalVisible(true);
          }}
        />
        <AppButton
          title="改状态"
          variant="secondary"
          onPress={() => setStatusModalVisible(true)}
        />
        <AppButton title="删除" variant="danger" onPress={onDelete} />
      </View>

      <AppModal
        visible={feeModalVisible}
        title="添加附加费用"
        onClose={() => setFeeModalVisible(false)}
      >
        <View style={styles.modalContent}>
          <AppInput
            label="金额"
            value={feeAmount}
            onChangeText={setFeeAmount}
            placeholder="可输入负值"
            keyboardType="numeric"
          />
          <AppInput
            label="备注"
            value={feeRemark}
            onChangeText={setFeeRemark}
            placeholder="选填"
          />
          <AppButton title="保存附加费" onPress={onAddFee} />
        </View>
      </AppModal>

      <AppModal
        visible={useCountModalVisible}
        title="记录使用次数"
        onClose={() => setUseCountModalVisible(false)}
      >
        <View style={styles.modalContent}>
          <AppInput
            label="使用次数"
            value={nextUseCount}
            onChangeText={setNextUseCount}
            keyboardType="numeric"
            placeholder="请输入整数"
          />
          <AppButton title="更新次数" onPress={onSaveUseCount} />
        </View>
      </AppModal>

      <AppModal
        visible={statusModalVisible}
        title="修改资产状态"
        onClose={() => setStatusModalVisible(false)}
      >
        <View style={styles.modalContent}>
          <AppButton title="服役中" onPress={() => onChangeStatus(0)} />
          <AppButton title="已停用" variant="secondary" onPress={() => onChangeStatus(1)} />
          <AppButton title="已卖出" variant="secondary" onPress={() => onChangeStatus(2)} />
          <AppButton title="报废丢失" variant="secondary" onPress={() => onChangeStatus(3)} />
        </View>
      </AppModal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 30,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  subtitle: {
    fontWeight: "600",
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLabel: {
    color: colors.textSecondary,
  },
  rowValue: {
    color: colors.textPrimary,
    fontWeight: "600",
    maxWidth: "60%",
    textAlign: "right",
  },
  emptyFeeText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  buttonRow: {
    gap: 10,
  },
  modalContent: {
    gap: 10,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  emptyText: {
    color: colors.textSecondary,
  },
});
