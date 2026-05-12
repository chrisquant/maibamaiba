import { useCallback, useState } from "react";
import {
  createCategory,
  deleteCategoryAndAssets,
  deleteCategoryAndMigrate,
  getCategoryAssetCount,
  getCategories,
  reorderCategories,
  updateCategory,
} from "../db/categoryRepository";
import { Category } from "../domain/models/types";

export const useCategories = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const all = await getCategories();
      setCategories(all);
    } finally {
      setLoading(false);
    }
  }, []);

  const createOne = useCallback(
    async (name: string, icon?: string | null) => {
      await createCategory(name, icon);
      await reload();
    },
    [reload],
  );

  const updateOne = useCallback(
    async (id: number, name: string, icon?: string | null) => {
      await updateCategory(id, name, icon);
      await reload();
    },
    [reload],
  );

  const deleteOneWithDeleteAssets = useCallback(
    async (id: number) => {
      await deleteCategoryAndAssets(id);
      await reload();
    },
    [reload],
  );

  const deleteOneWithMigration = useCallback(
    async (id: number, targetCategoryId: number) => {
      await deleteCategoryAndMigrate(id, targetCategoryId);
      await reload();
    },
    [reload],
  );

  const getAssetCount = useCallback(async (id: number) => {
    return getCategoryAssetCount(id);
  }, []);

  const saveOrder = useCallback(
    async (orderedIds: number[]) => {
      await reorderCategories(orderedIds);
      await reload();
    },
    [reload],
  );

  return {
    categories,
    loading,
    reload,
    createOne,
    updateOne,
    deleteOneWithDeleteAssets,
    deleteOneWithMigration,
    getAssetCount,
    saveOrder,
  };
};
