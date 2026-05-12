import { openDatabaseAsync, SQLiteDatabase } from "expo-sqlite";
import { migration001 } from "./migrations/001_initial";
import { migration002 } from "./migrations/002_add_deactivated_at";
import { migration003 } from "./migrations/003_add_category_sort_order";
import { migration004 } from "./migrations/004_add_asset_sort_order";

export const DB_NAME = "daily_cost.db";
const DB_SCHEMA_VERSION = 4;

let database: SQLiteDatabase | null = null;

const ensureDefaultCategories = async (db: SQLiteDatabase) => {
  const defaults = [
    { name: "数码", icon: "💻" },
    { name: "家电", icon: "🏠" },
    { name: "服饰", icon: "👕" },
    { name: "汽车", icon: "🚗" },
    { name: "其他", icon: "📦" },
  ];

  for (const item of defaults) {
    await db.runAsync(
      `INSERT OR IGNORE INTO category (name, icon, isDefault) VALUES (?, ?, 1);`,
      [item.name, item.icon],
    );
  }
};

const applyMigrations = async (db: SQLiteDatabase, version: number) => {
  if (version < 1) {
    await migration001(db);
    await ensureDefaultCategories(db);
    version = 1;
    await db.execAsync(`PRAGMA user_version = 1;`);
  }

  if (version < 2) {
    await migration002(db);
    await db.execAsync(`PRAGMA user_version = 2;`);
  }

  if (version < 3) {
    await migration003(db);
    await db.execAsync(`PRAGMA user_version = 3;`);
  }

  if (version < 4) {
    await migration004(db);
    await db.execAsync(`PRAGMA user_version = 4;`);
  }
};

export const initDatabase = async () => {
  if (database) {
    return database;
  }

  const db = await openDatabaseAsync(DB_NAME);
  await db.execAsync("PRAGMA foreign_keys = ON;");
  const [{ user_version: currentVersion }] = await db.getAllAsync<{
    user_version: number;
  }>("PRAGMA user_version;");

  if (currentVersion < DB_SCHEMA_VERSION) {
    await applyMigrations(db, currentVersion);
  }

  database = db;
  return db;
};

export const getDatabase = async () => {
  if (!database) {
    return initDatabase();
  }

  return database;
};
