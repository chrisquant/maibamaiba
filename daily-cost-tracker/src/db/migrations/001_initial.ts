import { SQLiteDatabase } from "expo-sqlite";

export const migration001 = async (db: SQLiteDatabase) => {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS category (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      icon TEXT,
      isDefault INTEGER DEFAULT 0
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS asset (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      buyTime TEXT NOT NULL,
      category TEXT,
      image TEXT,
      addFee REAL DEFAULT 0,
      useCount INTEGER DEFAULT 0,
      warrantyTime TEXT,
      targetCost REAL,
      status INTEGER DEFAULT 0,
      sellPrice REAL DEFAULT 0,
      remark TEXT,
      holdDays INTEGER DEFAULT 0,
      dailyCost REAL DEFAULT 0,
      updatedAt TEXT,
      sortOrder INTEGER
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS wish (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      expectPrice REAL,
      expectDays INTEGER,
      expectDaily REAL,
      level INTEGER
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS addFeeItem (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assetId INTEGER NOT NULL,
      amount REAL NOT NULL,
      remark TEXT,
      createdAt TEXT,
      FOREIGN KEY (assetId) REFERENCES asset(id) ON DELETE CASCADE
    );
  `);
};
