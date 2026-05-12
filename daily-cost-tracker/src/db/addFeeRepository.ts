import { AddFeeItem } from "../domain/models/types";
import { getDatabase } from "./database";

export const getAddFeeItemsByAsset = async (
  assetId: number,
): Promise<AddFeeItem[]> => {
  const db = await getDatabase();
  return db.getAllAsync<AddFeeItem>(
    "SELECT * FROM addFeeItem WHERE assetId = ? ORDER BY id DESC;",
    [assetId],
  );
};

export const createAddFeeItem = async (
  assetId: number,
  amount: number,
  remark?: string | null,
) => {
  const db = await getDatabase();
  const createdAt = new Date().toISOString();
  await db.runAsync(
    "INSERT INTO addFeeItem (assetId, amount, remark, createdAt) VALUES (?, ?, ?, ?);",
    [assetId, amount, remark ?? null, createdAt],
  );
};
