import { getDatabase } from "./database";
import { Asset } from "../domain/models/types";
import { calcDailyCost, calcHoldDays } from "../domain/calculators/costCalculator";
import { formatDate } from "../utils/format";
import { createAddFeeItem } from "./addFeeRepository";

export type UpsertAssetPayload = {
  name: string;
  price: number;
  buyTime: string;
  category: string;
  image?: string | null;
  addFee?: number;
  useCount?: number;
  warrantyTime?: string | null;
  targetCost?: number | null;
  status?: 0 | 1 | 2 | 3;
  deactivatedAt?: string | null;
  sellPrice?: number;
  remark?: string | null;
};

const toStartOfDay = (value: Date) =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate());

const calcSnapshot = (params: {
  buyTime: string;
  price: number;
  addFee: number;
  useCount: number;
  status: 0 | 1 | 2 | 3;
  deactivatedAt?: string | null;
}) => {
  const now = toStartOfDay(new Date());
  const buyDate = toStartOfDay(new Date(params.buyTime));
  const fallbackStopDate = formatDate(now);
  const stopDateStr = params.deactivatedAt ?? fallbackStopDate;
  const stopDate = toStartOfDay(new Date(stopDateStr));

  const holdDays =
    params.status === 0
      ? Math.max(0, calcHoldDays(params.buyTime, now))
      : Math.max(0, calcHoldDays(params.buyTime, stopDate));

  const dailyCost =
    calcDailyCost({
      price: params.price,
      addFee: params.addFee,
      holdDays,
      useCount: params.useCount,
    }) ?? 0;

  const normalizedDeactivatedAt =
    params.status === 0 ? null : formatDate(stopDate >= buyDate ? stopDate : buyDate);

  return {
    holdDays,
    dailyCost,
    deactivatedAt: normalizedDeactivatedAt,
  };
};

export const getAssets = async (): Promise<Asset[]> => {
  const db = await getDatabase();
  return db.getAllAsync<Asset>("SELECT * FROM asset ORDER BY sortOrder ASC, id DESC;");
};

export const getAssetById = async (id: number): Promise<Asset | null> => {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Asset>("SELECT * FROM asset WHERE id = ?;", [id]);
  return row ?? null;
};

export const createAsset = async (payload: UpsertAssetPayload): Promise<number> => {
  const db = await getDatabase();
  const now = formatDate(new Date());
  const minSortRow = await db.getFirstAsync<{ minSort: number }>(
    "SELECT COALESCE(MIN(sortOrder), 1) AS minSort FROM asset;",
  );
  const nextSortOrder = (minSortRow?.minSort ?? 1) - 1;
  const addFee = payload.addFee ?? 0;
  const price = payload.price;
  const status = payload.status ?? 0;
  const snapshot = calcSnapshot({
    buyTime: payload.buyTime,
    price,
    addFee,
    useCount: payload.useCount ?? 0,
    status,
    deactivatedAt: payload.deactivatedAt,
  });

  const result = await db.runAsync(
    `INSERT INTO asset (
      name, price, buyTime, category, image, addFee, useCount, warrantyTime,
      targetCost, status, deactivatedAt, sellPrice, remark, holdDays, dailyCost, updatedAt, sortOrder
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      payload.name.trim(),
      price,
      payload.buyTime,
      payload.category,
      payload.image ?? null,
      addFee,
      payload.useCount ?? 0,
      payload.warrantyTime ?? null,
      payload.targetCost ?? null,
      status,
      snapshot.deactivatedAt,
      payload.sellPrice ?? 0,
      payload.remark ?? null,
      snapshot.holdDays,
      snapshot.dailyCost,
      now,
      nextSortOrder,
    ],
  );

  return result.lastInsertRowId;
};

export const updateAsset = async (id: number, payload: UpsertAssetPayload): Promise<void> => {
  const db = await getDatabase();
  const now = formatDate(new Date());
  const addFee = payload.addFee ?? 0;
  const price = payload.price;
  const status = payload.status ?? 0;
  const snapshot = calcSnapshot({
    buyTime: payload.buyTime,
    price,
    addFee,
    useCount: payload.useCount ?? 0,
    status,
    deactivatedAt: payload.deactivatedAt,
  });

  await db.runAsync(
    `UPDATE asset SET
      name = ?, price = ?, buyTime = ?, category = ?, image = ?, addFee = ?,
      useCount = ?, warrantyTime = ?, targetCost = ?, status = ?, deactivatedAt = ?, sellPrice = ?,
      remark = ?, holdDays = ?, dailyCost = ?, updatedAt = ?
      WHERE id = ?;`,
    [
      payload.name.trim(),
      price,
      payload.buyTime,
      payload.category,
      payload.image ?? null,
      addFee,
      payload.useCount ?? 0,
      payload.warrantyTime ?? null,
      payload.targetCost ?? null,
      status,
      snapshot.deactivatedAt,
      payload.sellPrice ?? 0,
      payload.remark ?? null,
      snapshot.holdDays,
      snapshot.dailyCost,
      now,
      id,
    ],
  );
};

export const deleteAsset = async (id: number) => {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM asset WHERE id = ?;", [id]);
};

export const updateAssetStatus = async (
  id: number,
  status: 0 | 1 | 2 | 3,
  sellPrice?: number,
  deactivatedAt?: string | null,
) => {
  const db = await getDatabase();
  const item = await getAssetById(id);
  if (!item) {
    return;
  }

  const snapshot = calcSnapshot({
    buyTime: item.buyTime,
    price: item.price,
    addFee: item.addFee,
    useCount: item.useCount,
    status,
    deactivatedAt: status === 0 ? null : (deactivatedAt ?? formatDate(new Date())),
  });

  await db.runAsync(
    "UPDATE asset SET status = ?, deactivatedAt = ?, sellPrice = ?, holdDays = ?, dailyCost = ?, updatedAt = ? WHERE id = ?;",
    [
      status,
      snapshot.deactivatedAt,
      sellPrice ?? item.sellPrice ?? 0,
      snapshot.holdDays,
      snapshot.dailyCost,
      formatDate(new Date()),
      id,
    ],
  );
};

export const updateAssetUseCount = async (id: number, useCount: number) => {
  const db = await getDatabase();
  const item = await getAssetById(id);
  if (!item) {
    return;
  }
  const nextUseCount = Math.max(0, Math.floor(useCount));
  const snapshot = calcSnapshot({
    buyTime: item.buyTime,
    price: item.price,
    addFee: item.addFee,
    useCount: nextUseCount,
    status: item.status,
    deactivatedAt: item.deactivatedAt,
  });

  await db.runAsync(
    "UPDATE asset SET useCount = ?, holdDays = ?, dailyCost = ?, updatedAt = ? WHERE id = ?;",
    [nextUseCount, snapshot.holdDays, snapshot.dailyCost, formatDate(new Date()), id],
  );
};

export const addAssetFee = async (id: number, amount: number, remark?: string | null) => {
  const db = await getDatabase();
  const item = await getAssetById(id);
  if (!item) {
    return;
  }

  await createAddFeeItem(id, amount, remark);
  const nextAddFee = item.addFee + amount;
  const snapshot = calcSnapshot({
    buyTime: item.buyTime,
    price: item.price,
    addFee: nextAddFee,
    useCount: item.useCount,
    status: item.status,
    deactivatedAt: item.deactivatedAt,
  });

  await db.runAsync(
    "UPDATE asset SET addFee = ?, holdDays = ?, dailyCost = ?, updatedAt = ? WHERE id = ?;",
    [nextAddFee, snapshot.holdDays, snapshot.dailyCost, formatDate(new Date()), id],
  );
};

export const refreshAllAssets = async () => {
  const db = await getDatabase();
  const activeAssets = await db.getAllAsync<Asset>(
    "SELECT id, buyTime, price, addFee, useCount FROM asset WHERE status = 0;",
  );

  const now = new Date();
  const updatedAt = formatDate(now);

  for (const item of activeAssets) {
    const holdDays = Math.max(0, calcHoldDays(item.buyTime, now));
    const dailyCost = calcDailyCost({
      price: item.price,
      addFee: item.addFee,
      holdDays,
      useCount: item.useCount ?? 0,
    });

    await db.runAsync(
      "UPDATE asset SET holdDays = ?, dailyCost = ?, updatedAt = ? WHERE id = ?;",
      [holdDays, dailyCost ?? 0, updatedAt, item.id],
    );
  }
};

export const reorderAssets = async (orderedIds: number[]) => {
  if (orderedIds.length === 0) {
    return;
  }
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const [index, id] of orderedIds.entries()) {
      await tx.runAsync("UPDATE asset SET sortOrder = ? WHERE id = ?;", [index + 1, id]);
    }
  });
};
