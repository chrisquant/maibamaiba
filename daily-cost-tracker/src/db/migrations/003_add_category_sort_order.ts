import { SQLiteDatabase } from "expo-sqlite";

export const migration003 = async (db: SQLiteDatabase) => {
  const columns = await db.getAllAsync<{ name: string }>("PRAGMA table_info(category);");
  const hasSortOrder = columns.some((item) => item.name === "sortOrder");

  if (!hasSortOrder) {
    await db.execAsync("ALTER TABLE category ADD COLUMN sortOrder INTEGER;");
  }

  const rows = await db.getAllAsync<{ id: number }>(
    "SELECT id FROM category ORDER BY isDefault DESC, id ASC;",
  );

  for (const [index, row] of rows.entries()) {
    await db.runAsync("UPDATE category SET sortOrder = ? WHERE id = ?;", [index + 1, row.id]);
  }
};
