import { useCallback, useState } from "react";
import {
  createWish,
  deleteWish,
  getWishes,
  updateWish,
  UpsertWishPayload,
} from "../db/wishRepository";
import { Wish } from "../domain/models/types";

export const useWishes = () => {
  const [wishes, setWishes] = useState<Wish[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const all = await getWishes();
      setWishes(all);
    } finally {
      setLoading(false);
    }
  }, []);

  const createOne = useCallback(
    async (payload: UpsertWishPayload) => {
      await createWish(payload);
      await reload();
    },
    [reload],
  );

  const updateOne = useCallback(
    async (id: number, payload: UpsertWishPayload) => {
      await updateWish(id, payload);
      await reload();
    },
    [reload],
  );

  const deleteOne = useCallback(
    async (id: number) => {
      await deleteWish(id);
      await reload();
    },
    [reload],
  );

  return {
    wishes,
    loading,
    reload,
    createOne,
    updateOne,
    deleteOne,
  };
};
