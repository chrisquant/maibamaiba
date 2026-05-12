import { NativeStackScreenProps } from "@react-navigation/native-stack";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { AppButton } from "../components/base/AppButton";
import { AppInput } from "../components/base/AppInput";
import { getCategories } from "../db/categoryRepository";
import { deleteWish } from "../db/wishRepository";
import { Category } from "../domain/models/types";
import { assetFormSchema } from "../domain/validators/assetValidator";
import { useAssets } from "../hooks/useAssets";
import { RootStackParamList } from "../navigation/types";
import { colors } from "../theme/colors";
import { formatDate } from "../utils/format";

type Props = NativeStackScreenProps<RootStackParamList, "AssetForm">;
type Errors = Partial<
  Record<
    "name" | "category" | "price" | "buyTime" | "deactivatedAt" | "addFee" | "useCount" | "sellPrice",
    string
  >
>;

const statusItems: Array<{ label: string; value: 0 | 1 | 2 | 3 }> = [
  { label: "服役中", value: 0 },
  { label: "已停用", value: 1 },
  { label: "已卖出", value: 2 },
  { label: "报废丢失", value: 3 },
];

const toNumber = (value: string) => {
  if (!value.trim()) {
    return 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

export const AssetFormScreen = ({ navigation, route }: Props) => {
  const assetId = route.params?.assetId;
  const prefill = route.params?.prefill;
  const sourceWishId = route.params?.sourceWishId;
  const { createOne, updateOne, getAssetById } = useAssets();
  const [categories, setCategories] = useState<Category[]>([]);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [buyTime, setBuyTime] = useState(formatDate(new Date()));
  const [deactivatedAt, setDeactivatedAt] = useState(formatDate(new Date()));
  const [addFee, setAddFee] = useState("");
  const [useCount, setUseCount] = useState("");
  const [remark, setRemark] = useState("");
  const [status, setStatus] = useState<0 | 1 | 2 | 3>(0);
  const [sellPrice, setSellPrice] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(new Date());
  const [datePickerTarget, setDatePickerTarget] = useState<"buyTime" | "deactivatedAt">("buyTime");

  useEffect(() => {
    const fetchCategories = async () => {
      const all = await getCategories();
      setCategories(all);
      if (!assetId && all[0]) {
        setCategory(all[0].name);
      }
    };
    void fetchCategories();
  }, [assetId]);

  useEffect(() => {
    if (!prefill || assetId) {
      return;
    }
    setName(prefill.name);
    setPrice(String(prefill.price));
  }, [prefill, assetId]);

  useEffect(() => {
    if (!assetId) {
      return;
    }
    const loadAsset = async () => {
      const item = await getAssetById(assetId);
      if (!item) {
        Alert.alert("提示", "资产不存在");
        navigation.goBack();
        return;
      }

      setName(item.name);
      setCategory(item.category ?? "");
      setPrice(String(item.price));
      setBuyTime(item.buyTime);
      setDeactivatedAt(item.deactivatedAt ?? formatDate(new Date()));
      setAddFee(String(item.addFee));
      setUseCount(String(item.useCount));
      setRemark(item.remark ?? "");
      setStatus(item.status);
      setSellPrice(String(item.sellPrice));
    };
    void loadAsset();
  }, [assetId, getAssetById, navigation]);

  const title = useMemo(() => (assetId ? "编辑资产" : "新增资产"), [assetId]);

  const onDateChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (!selectedDate) {
      if (Platform.OS !== "ios") {
        setShowDatePicker(false);
      }
      return;
    }
    if (Platform.OS === "ios") {
      setTempDate(selectedDate);
      return;
    }
    if (datePickerTarget === "buyTime") {
      setBuyTime(formatDate(selectedDate));
    } else {
      setDeactivatedAt(formatDate(selectedDate));
    }
    setShowDatePicker(false);
  };

  const openDatePicker = (target: "buyTime" | "deactivatedAt") => {
    setDatePickerTarget(target);
    setTempDate(new Date(target === "buyTime" ? buyTime : deactivatedAt));
    setShowDatePicker(true);
  };

  const onConfirmDate = () => {
    if (datePickerTarget === "buyTime") {
      setBuyTime(formatDate(tempDate));
    } else {
      setDeactivatedAt(formatDate(tempDate));
    }
    setShowDatePicker(false);
  };

  const onSubmit = useCallback(async () => {
    const priceValue = toNumber(price);
    const addFeeValue = toNumber(addFee);
    const useCountValue = toNumber(useCount);
    const sellPriceValue = toNumber(sellPrice);

    const result = assetFormSchema.safeParse({
      name,
      category,
      price: priceValue,
      buyTime,
      deactivatedAt: status === 1 ? deactivatedAt : null,
      addFee: addFeeValue,
      useCount: useCountValue,
      status,
      sellPrice: sellPriceValue,
    });

    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      setErrors({
        name: fieldErrors.name?.[0],
        category: fieldErrors.category?.[0],
        price: fieldErrors.price?.[0],
        buyTime: fieldErrors.buyTime?.[0],
        deactivatedAt: fieldErrors.deactivatedAt?.[0],
        addFee: fieldErrors.addFee?.[0],
        useCount: fieldErrors.useCount?.[0],
        sellPrice: fieldErrors.sellPrice?.[0],
      });
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      const payload = {
        name: result.data.name,
        category: result.data.category,
        price: result.data.price,
        buyTime: result.data.buyTime,
        deactivatedAt: result.data.deactivatedAt ?? null,
        addFee: result.data.addFee,
        useCount: result.data.useCount,
        remark: remark.trim() ? remark.trim() : null,
        status: result.data.status,
        sellPrice: result.data.sellPrice,
      };

      if (assetId) {
        await updateOne(assetId, payload);
      } else {
        await createOne(payload);
        if (sourceWishId) {
          await deleteWish(sourceWishId);
        }
      }
      navigation.goBack();
    } catch {
      Alert.alert("保存失败", "请重试");
    } finally {
      setSubmitting(false);
    }
  }, [
    addFee,
    assetId,
    buyTime,
    category,
    createOne,
    deactivatedAt,
    getAssetById,
    name,
    navigation,
    price,
    remark,
    sellPrice,
    sourceWishId,
    status,
    updateOne,
    useCount,
  ]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title,
      headerRight: () => (
        <Pressable
          onPress={onSubmit}
          disabled={submitting}
          style={({ pressed }) => [
            styles.headerSaveBtn,
            pressed || submitting ? styles.headerSaveBtnPressed : undefined,
          ]}
        >
          <Text style={styles.headerSaveText}>{submitting ? "保存中" : "保存"}</Text>
        </Pressable>
      ),
    });
  }, [navigation, onSubmit, submitting, title]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={16}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <AppInput
            label="物品名称"
            value={name}
            onChangeText={setName}
            placeholder="请输入物品名称"
            error={errors.name}
          />

          <Text style={styles.label}>分类</Text>
          <View style={styles.rowWrap}>
            {categories.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => setCategory(item.name)}
                style={[
                  styles.chip,
                  category === item.name ? styles.chipActive : undefined,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    category === item.name ? styles.chipTextActive : undefined,
                  ]}
                >
                  {item.icon ? `${item.icon} ` : ""}
                  {item.name}
                </Text>
              </Pressable>
            ))}
          </View>
          {errors.category ? <Text style={styles.errorText}>{errors.category}</Text> : null}

          <AppInput
            label="购入价格"
            value={price}
            onChangeText={setPrice}
            placeholder="例如 1999.00"
            keyboardType="numeric"
            error={errors.price}
          />
          <Text style={styles.label}>购买日期</Text>
          <Pressable
            onPress={() => openDatePicker("buyTime")}
            style={({ pressed }) => [
              styles.dateField,
              pressed ? { opacity: 0.8 } : undefined,
              errors.buyTime ? styles.dateFieldError : undefined,
            ]}
          >
            <Text style={styles.dateFieldText}>{buyTime}</Text>
          </Pressable>
          {errors.buyTime ? <Text style={styles.errorText}>{errors.buyTime}</Text> : null}
          {showDatePicker ? (
            <View style={styles.datePickerBox}>
              <DateTimePicker
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                value={
                  Platform.OS === "ios"
                    ? tempDate
                    : new Date(datePickerTarget === "buyTime" ? buyTime : deactivatedAt)
                }
                maximumDate={new Date()}
                onChange={onDateChange}
              />
              {Platform.OS === "ios" ? (
                <View style={styles.datePickerActions}>
                  <AppButton
                    title="取消"
                    variant="secondary"
                    onPress={() => setShowDatePicker(false)}
                  />
                  <AppButton title="确认" onPress={onConfirmDate} />
                </View>
              ) : null}
            </View>
          ) : null}
          <AppInput
            label="附加费用合计"
            value={addFee}
            onChangeText={setAddFee}
            placeholder="可负数"
            keyboardType="numeric"
            error={errors.addFee}
          />
          <AppInput
            label="使用次数"
            value={useCount}
            onChangeText={setUseCount}
            placeholder="默认 0"
            keyboardType="numeric"
            error={errors.useCount}
          />

          <Text style={styles.label}>资产状态</Text>
          <View style={styles.rowWrap}>
            {statusItems.map((item) => (
              <Pressable
                key={item.value}
                onPress={() => setStatus(item.value)}
                style={[styles.chip, status === item.value ? styles.chipActive : undefined]}
              >
                <Text
                  style={[
                    styles.chipText,
                    status === item.value ? styles.chipTextActive : undefined,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {status === 2 ? (
            <AppInput
              label="卖出残值"
              value={sellPrice}
              onChangeText={setSellPrice}
              placeholder="例如 1200"
              keyboardType="numeric"
              error={errors.sellPrice}
            />
          ) : null}

          {status === 1 ? (
            <>
              <Text style={styles.label}>停用日期</Text>
              <Pressable
                onPress={() => openDatePicker("deactivatedAt")}
                style={({ pressed }) => [
                  styles.dateField,
                  pressed ? { opacity: 0.8 } : undefined,
                  errors.deactivatedAt ? styles.dateFieldError : undefined,
                ]}
              >
                <Text style={styles.dateFieldText}>{deactivatedAt}</Text>
              </Pressable>
              {errors.deactivatedAt ? (
                <Text style={styles.errorText}>{errors.deactivatedAt}</Text>
              ) : null}
            </>
          ) : null}

          <AppInput
            label="备注"
            value={remark}
            onChangeText={setRemark}
            placeholder="型号、备注信息"
            multiline
          />

        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
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
    paddingBottom: 36,
  },
  headerSaveBtn: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    minWidth: 56,
    height: 30,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0,
    marginRight: 2,
  },
  headerSaveBtnPressed: {
    opacity: 0.7,
  },
  headerSaveText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  label: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "500",
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
    backgroundColor: "#dbeafe",
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  chipTextActive: {
    color: colors.primary,
    fontWeight: "600",
  },
  errorText: {
    color: colors.error,
    fontSize: 12,
    marginTop: -4,
  },
  dateField: {
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  dateFieldError: {
    borderColor: colors.error,
  },
  dateFieldText: {
    color: colors.textPrimary,
    fontSize: 14,
  },
  datePickerBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: "#fff",
    paddingTop: 6,
    paddingBottom: 10,
  },
  datePickerActions: {
    marginTop: 4,
    paddingHorizontal: 12,
    gap: 8,
  },
});
