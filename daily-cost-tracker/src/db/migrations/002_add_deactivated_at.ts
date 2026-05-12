import { SQLiteDatabase } from "expo-sqlite";

export const migration002 = async (db: SQLiteDatabase) => {
  const columns = await db.getAllAsync<{ name: string }>("PRAGMA table_info(asset);");
  const hasColumn = columns.some((item) => item.name === "deactivatedAt");
  if (!hasColumn) {
    await db.execAsync("ALTER TABLE asset ADD COLUMN deactivatedAt TEXT;");
  }
};
