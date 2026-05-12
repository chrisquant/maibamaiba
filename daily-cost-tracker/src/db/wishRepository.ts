import { Wish } from "../domain/models/types";
import { getDatabase } from "./database";

export type UpsertWishPayload = {
  name: string;
  expectPrice: number;
  expectDays: number;
  level: number;
};

export const getWishes = async (): Promise<Wish[]> => {
  const db = await getDatabase();
  return db.getAllAsync<Wish>("SELECT * FROM wish ORDER BY id DESC;");
};

export const createWish = async (payload: UpsertWishPayload) => {
  const db = await getDatabase();
  const expectDaily =
    payload.expectDays > 0 ? payload.expectPrice / payload.expectDays : 0;
  await db.runAsync(
    "INSERT INTO wish (name, expectPrice, expectDays, expectDaily, level) VALUES (?, ?, ?, ?, ?);",
    [
      payload.name.trim(),
      payload.expectPrice,
      payload.expectDays,
      expectDaily,
      payload.level,
    ],
  );
};

export const updateWish = async (id: number, payload: UpsertWishPayload) => {
  const db = await getDatabase();
  const expectDaily =
    payload.expectDays > 0 ? payload.expectPrice / payload.expectDays : 0;
  await db.runAsync(
    "UPDATE wish SET name = ?, expectPrice = ?, expectDays = ?, expectDaily = ?, level = ? WHERE id = ?;",
    [
      payload.name.trim(),
      payload.expectPrice,
      payload.expectDays,
      expectDaily,
      payload.level,
      id,
    ],
  );
};

export const deleteWish = async (id: number) => {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM wish WHERE id = ?;", [id]);
};
