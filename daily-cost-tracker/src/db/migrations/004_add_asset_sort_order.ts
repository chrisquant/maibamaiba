import { SQLiteDatabase } from "expo-sqlite";

export const migration004 = async (db: SQLiteDatabase) => {
  const columns = await db.getAllAsync<{ name: string }>("PRAGMA table_info(asset);");
  const hasSortOrder = columns.some((item) => item.name === "sortOrder");

  if (!hasSortOrder) {
    await db.execAsync("ALTER TABLE asset ADD COLUMN sortOrder INTEGER;");
  }

  const rows = await db.getAllAsync<{ id: number }>("SELECT id FROM asset ORDER BY id DESC;");
  for (const [index, row] of rows.entries()) {
    await db.runAsync("UPDATE asset SET sortOrder = ? WHERE id = ?;", [index + 1, row.id]);
  }
};
