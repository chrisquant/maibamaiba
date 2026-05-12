import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { SQLiteDatabase } from "expo-sqlite";
import { DB_NAME, getDatabase } from "../db/database";

type CategoryRow = {
  id: number;
  name: string;
  icon: string | null;
  isDefault: 0 | 1;
  sortOrder: number | null;
};

type AssetRow = {
  id: number;
  name: string;
  price: number;
  buyTime: string;
  category: string | null;
  image: string | null;
  addFee: number;
  useCount: number;
  warrantyTime: string | null;
  targetCost: number | null;
  status: 0 | 1 | 2 | 3;
  deactivatedAt: string | null;
  sellPrice: number;
  remark: string | null;
  holdDays: number;
  dailyCost: number;
  updatedAt: string | null;
  sortOrder: number | null;
};

type WishRow = {
  id: number;
  name: string;
  expectPrice: number | null;
  expectDays: number | null;
  expectDaily: number | null;
  level: number | null;
};

type AddFeeItemRow = {
  id: number;
  assetId: number;
  amount: number;
  remark: string | null;
  createdAt: string | null;
};

type BackupPayload = {
  meta: {
    app: "daily-cost-tracker";
    schemaVersion: number;
    exportedAt: string;
  };
  data: {
    categories: CategoryRow[];
    assets: AssetRow[];
    wishes: WishRow[];
    addFeeItems: AddFeeItemRow[];
  };
};

export type BackupCounts = {
  categories: number;
  assets: number;
  wishes: number;
  addFeeItems: number;
};

export type BackupImportMode = "overwrite" | "append";

export type ImportResult = {
  mode: BackupImportMode;
  counts: BackupCounts;
};

export type BackupPreviewResult =
  | { canceled: true }
  | {
      canceled: false;
      fileName: string;
      fileUri: string;
      exportedAt: string;
      schemaVersion: number;
      counts: BackupCounts;
      payload: BackupPayload;
    };

const formatBytes = (bytes: number) => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(2)} KB`;
  }
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
};

const ensureBackupPayload = (value: unknown): BackupPayload => {
  if (typeof value !== "object" || !value) {
    throw new Error("备份文件格式无效");
  }
  const payload = value as Partial<BackupPayload>;
  if (!payload.data) {
    throw new Error("备份文件缺少 data 字段");
  }

  const categories = Array.isArray(payload.data.categories) ? payload.data.categories : [];
  const assets = Array.isArray(payload.data.assets) ? payload.data.assets : [];
  const wishes = Array.isArray(payload.data.wishes) ? payload.data.wishes : [];
  const addFeeItems = Array.isArray(payload.data.addFeeItems) ? payload.data.addFeeItems : [];

  return {
    meta: {
      app: "daily-cost-tracker",
      schemaVersion:
        typeof payload.meta?.schemaVersion === "number" ? payload.meta.schemaVersion : 0,
      exportedAt:
        typeof payload.meta?.exportedAt === "string"
          ? payload.meta.exportedAt
          : new Date().toISOString(),
    },
    data: {
      categories: categories as CategoryRow[],
      assets: assets as AssetRow[],
      wishes: wishes as WishRow[],
      addFeeItems: addFeeItems as AddFeeItemRow[],
    },
  };
};

const getBackupCounts = (payload: BackupPayload): BackupCounts => ({
  categories: payload.data.categories.length,
  assets: payload.data.assets.length,
  wishes: payload.data.wishes.length,
  addFeeItems: payload.data.addFeeItems.length,
});

const resetSqliteSequence = async (tx: SQLiteDatabase, table: string, maxId: number) => {
  await tx.runAsync("DELETE FROM sqlite_sequence WHERE name = ?;", [table]);
  if (maxId > 0) {
    await tx.runAsync("INSERT INTO sqlite_sequence (name, seq) VALUES (?, ?);", [table, maxId]);
  }
};

export const getLocalStorageUsage = async () => {
  const rootDir = FileSystem.documentDirectory;
  if (!rootDir) {
    return { bytes: 0, label: "0 B" };
  }

  const baseUri = `${rootDir}SQLite/${DB_NAME}`;
  const candidateUris = [baseUri, `${baseUri}-wal`, `${baseUri}-shm`];
  let totalBytes = 0;

  for (const uri of candidateUris) {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists && typeof info.size === "number") {
      totalBytes += info.size;
    }
  }

  return {
    bytes: totalBytes,
    label: formatBytes(totalBytes),
  };
};

export const exportBackup = async () => {
  const db = await getDatabase();
  const [categories, assets, wishes, addFeeItems] = await Promise.all([
    db.getAllAsync<CategoryRow>("SELECT * FROM category ORDER BY id ASC;"),
    db.getAllAsync<AssetRow>("SELECT * FROM asset ORDER BY id ASC;"),
    db.getAllAsync<WishRow>("SELECT * FROM wish ORDER BY id ASC;"),
    db.getAllAsync<AddFeeItemRow>("SELECT * FROM addFeeItem ORDER BY id ASC;"),
  ]);

  const payload: BackupPayload = {
    meta: {
      app: "daily-cost-tracker",
      schemaVersion: 4,
      exportedAt: new Date().toISOString(),
    },
    data: {
      categories,
      assets,
      wishes,
      addFeeItems,
    },
  };

  const targetDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!targetDir) {
    throw new Error("无法访问本地文件目录");
  }

  const fileUri = `${targetDir}daily-cost-backup-${Date.now()}.json`;
  await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(payload));

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(fileUri, {
      UTI: "public.json",
      mimeType: "application/json",
      dialogTitle: "导出备份文件",
    });
  }

  const info = await FileSystem.getInfoAsync(fileUri);
  const counts = getBackupCounts(payload);

  return {
    fileUri,
    sizeLabel: formatBytes(info.exists && info.size ? info.size : 0),
    counts,
  };
};

export const pickBackupForImport = async (): Promise<BackupPreviewResult> => {
  const picked = await DocumentPicker.getDocumentAsync({
    type: ["application/json", "public.json", "public.text"],
    copyToCacheDirectory: true,
  });

  if (picked.canceled || !picked.assets?.[0]) {
    return { canceled: true };
  }

  const pickedAsset = picked.assets[0];
  const content = await FileSystem.readAsStringAsync(pickedAsset.uri);
  const payload = ensureBackupPayload(JSON.parse(content));
  const counts = getBackupCounts(payload);

  return {
    canceled: false,
    fileName: pickedAsset.name,
    fileUri: pickedAsset.uri,
    exportedAt: payload.meta.exportedAt,
    schemaVersion: payload.meta.schemaVersion,
    counts,
    payload,
  };
};

const importByOverwrite = async (tx: SQLiteDatabase, payload: BackupPayload) => {
  await tx.runAsync("DELETE FROM addFeeItem;");
  await tx.runAsync("DELETE FROM asset;");
  await tx.runAsync("DELETE FROM wish;");
  await tx.runAsync("DELETE FROM category;");

  for (const row of payload.data.categories) {
    await tx.runAsync(
      `INSERT INTO category (id, name, icon, isDefault, sortOrder)
       VALUES (?, ?, ?, ?, ?);`,
      [row.id, row.name, row.icon ?? null, row.isDefault ?? 0, row.sortOrder ?? null],
    );
  }

  for (const row of payload.data.assets) {
    await tx.runAsync(
      `INSERT INTO asset (
        id, name, price, buyTime, category, image, addFee, useCount, warrantyTime, targetCost,
        status, deactivatedAt, sellPrice, remark, holdDays, dailyCost, updatedAt, sortOrder
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        row.id,
        row.name,
        row.price,
        row.buyTime,
        row.category ?? null,
        row.image ?? null,
        row.addFee ?? 0,
        row.useCount ?? 0,
        row.warrantyTime ?? null,
        row.targetCost ?? null,
        row.status ?? 0,
        row.deactivatedAt ?? null,
        row.sellPrice ?? 0,
        row.remark ?? null,
        row.holdDays ?? 0,
        row.dailyCost ?? 0,
        row.updatedAt ?? null,
        row.sortOrder ?? null,
      ],
    );
  }

  for (const row of payload.data.wishes) {
    await tx.runAsync(
      `INSERT INTO wish (id, name, expectPrice, expectDays, expectDaily, level)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [
        row.id,
        row.name,
        row.expectPrice ?? null,
        row.expectDays ?? null,
        row.expectDaily ?? null,
        row.level ?? null,
      ],
    );
  }

  for (const row of payload.data.addFeeItems) {
    await tx.runAsync(
      `INSERT INTO addFeeItem (id, assetId, amount, remark, createdAt)
       VALUES (?, ?, ?, ?, ?);`,
      [row.id, row.assetId, row.amount, row.remark ?? null, row.createdAt ?? null],
    );
  }

  const maxCategoryId = payload.data.categories.reduce((max, item) => Math.max(max, item.id), 0);
  const maxAssetId = payload.data.assets.reduce((max, item) => Math.max(max, item.id), 0);
  const maxWishId = payload.data.wishes.reduce((max, item) => Math.max(max, item.id), 0);
  const maxAddFeeId = payload.data.addFeeItems.reduce((max, item) => Math.max(max, item.id), 0);

  await resetSqliteSequence(tx, "category", maxCategoryId);
  await resetSqliteSequence(tx, "asset", maxAssetId);
  await resetSqliteSequence(tx, "wish", maxWishId);
  await resetSqliteSequence(tx, "addFeeItem", maxAddFeeId);
};

const importByAppend = async (tx: SQLiteDatabase, payload: BackupPayload) => {
  for (const row of payload.data.categories) {
    await tx.runAsync(
      `INSERT OR IGNORE INTO category (name, icon, isDefault, sortOrder)
       VALUES (?, ?, ?, ?);`,
      [row.name, row.icon ?? null, row.isDefault ?? 0, row.sortOrder ?? null],
    );
  }

  const oldAssetIdToNew = new Map<number, number>();
  for (const row of payload.data.assets) {
    const result = await tx.runAsync(
      `INSERT INTO asset (
        name, price, buyTime, category, image, addFee, useCount, warrantyTime, targetCost,
        status, deactivatedAt, sellPrice, remark, holdDays, dailyCost, updatedAt, sortOrder
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        row.name,
        row.price,
        row.buyTime,
        row.category ?? null,
        row.image ?? null,
        row.addFee ?? 0,
        row.useCount ?? 0,
        row.warrantyTime ?? null,
        row.targetCost ?? null,
        row.status ?? 0,
        row.deactivatedAt ?? null,
        row.sellPrice ?? 0,
        row.remark ?? null,
        row.holdDays ?? 0,
        row.dailyCost ?? 0,
        row.updatedAt ?? null,
        row.sortOrder ?? null,
      ],
    );
    oldAssetIdToNew.set(row.id, result.lastInsertRowId);
  }

  for (const row of payload.data.wishes) {
    await tx.runAsync(
      `INSERT INTO wish (name, expectPrice, expectDays, expectDaily, level)
       VALUES (?, ?, ?, ?, ?);`,
      [row.name, row.expectPrice ?? null, row.expectDays ?? null, row.expectDaily ?? null, row.level ?? null],
    );
  }

  for (const row of payload.data.addFeeItems) {
    const mappedAssetId = oldAssetIdToNew.get(row.assetId);
    if (!mappedAssetId) {
      continue;
    }
    await tx.runAsync(
      `INSERT INTO addFeeItem (assetId, amount, remark, createdAt)
       VALUES (?, ?, ?, ?);`,
      [mappedAssetId, row.amount, row.remark ?? null, row.createdAt ?? null],
    );
  }
};

export const importBackup = async (
  preview: BackupPreviewResult & { canceled: false },
  mode: BackupImportMode,
): Promise<ImportResult> => {
  const db = await getDatabase();
  const payload = preview.payload;

  await db.withExclusiveTransactionAsync(async (tx) => {
    if (mode === "overwrite") {
      await importByOverwrite(tx, payload);
      return;
    }
    await importByAppend(tx, payload);
  });

  const counts = getBackupCounts(payload);
  return {
    mode,
    counts,
  };
};
