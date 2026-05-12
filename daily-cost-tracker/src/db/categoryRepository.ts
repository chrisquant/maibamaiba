import { Category } from "../domain/models/types";
import { getDatabase } from "./database";

export const getCategories = async (): Promise<Category[]> => {
  const db = await getDatabase();
  return db.getAllAsync<Category>(
    "SELECT * FROM category ORDER BY sortOrder ASC, id ASC;",
  );
};

export const createCategory = async (name: string, icon?: string | null) => {
  const db = await getDatabase();
  const maxRow = await db.getFirstAsync<{ maxSort: number }>(
    "SELECT COALESCE(MAX(sortOrder), 0) AS maxSort FROM category;",
  );

  await db.runAsync(
    "INSERT INTO category (name, icon, isDefault, sortOrder) VALUES (?, ?, 0, ?);",
    [name.trim(), icon ?? null, (maxRow?.maxSort ?? 0) + 1],
  );
};

export const updateCategory = async (
  id: number,
  name: string,
  icon?: string | null,
) => {
  const db = await getDatabase();
  const nextName = name.trim();
  const category = await db.getFirstAsync<Category>("SELECT * FROM category WHERE id = ?;", [id]);
  if (!category) {
    return;
  }

  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync("UPDATE category SET name = ?, icon = ? WHERE id = ?;", [
      nextName,
      icon ?? null,
      id,
    ]);
    await tx.runAsync("UPDATE asset SET category = ? WHERE category = ?;", [
      nextName,
      category.name,
    ]);
  });
};

export const getCategoryAssetCount = async (id: number) => {
  const db = await getDatabase();
  const category = await db.getFirstAsync<Category>(
    "SELECT * FROM category WHERE id = ?;",
    [id],
  );
  if (!category) {
    return 0;
  }
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM asset WHERE category = ?;",
    [category.name],
  );
  return row?.count ?? 0;
};

export const deleteCategoryAndAssets = async (id: number) => {
  const db = await getDatabase();
  const category = await db.getFirstAsync<Category>(
    "SELECT * FROM category WHERE id = ?;",
    [id],
  );
  if (!category) {
    return;
  }

  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync("DELETE FROM asset WHERE category = ?;", [category.name]);
    await tx.runAsync("DELETE FROM category WHERE id = ?;", [id]);
  });
};

export const deleteCategoryAndMigrate = async (id: number, targetCategoryId: number) => {
  const db = await getDatabase();
  const source = await db.getFirstAsync<Category>("SELECT * FROM category WHERE id = ?;", [id]);
  const target = await db.getFirstAsync<Category>("SELECT * FROM category WHERE id = ?;", [
    targetCategoryId,
  ]);
  if (!source || !target || source.id === target.id) {
    return;
  }

  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(
      "UPDATE asset SET category = ? WHERE category = ?;",
      [target.name, source.name],
    );
    await tx.runAsync("DELETE FROM category WHERE id = ?;", [id]);
  });
};

export const reorderCategories = async (orderedIds: number[]) => {
  if (orderedIds.length === 0) {
    return;
  }
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const [index, id] of orderedIds.entries()) {
      await tx.runAsync("UPDATE category SET sortOrder = ? WHERE id = ?;", [index + 1, id]);
    }
  });
};
