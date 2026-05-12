import { useCallback, useState } from "react";
import {
  addAssetFee,
  createAsset,
  deleteAsset,
  getAssetById,
  getAssets,
  refreshAllAssets,
  reorderAssets,
  updateAssetStatus,
  updateAssetUseCount,
  updateAsset,
  UpsertAssetPayload,
} from "../db/assetRepository";
import { useAssetContext } from "../contexts/AssetContext";

export const useAssets = () => {
  const { assets, setAssets } = useAssetContext();
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      await refreshAllAssets();
      const all = await getAssets();
      setAssets(all);
    } finally {
      setLoading(false);
    }
  }, [setAssets]);

  const createOne = useCallback(
    async (payload: UpsertAssetPayload) => {
      const id = await createAsset(payload);
      await reload();
      return id;
    },
    [reload],
  );

  const updateOne = useCallback(
    async (id: number, payload: UpsertAssetPayload) => {
      await updateAsset(id, payload);
      await reload();
    },
    [reload],
  );

  const deleteOne = useCallback(
    async (id: number) => {
      await deleteAsset(id);
      await reload();
    },
    [reload],
  );

  const updateStatus = useCallback(
    async (
      id: number,
      status: 0 | 1 | 2 | 3,
      sellPrice?: number,
      deactivatedAt?: string | null,
    ) => {
      await updateAssetStatus(id, status, sellPrice, deactivatedAt);
      await reload();
    },
    [reload],
  );

  const updateUseCount = useCallback(
    async (id: number, useCount: number) => {
      await updateAssetUseCount(id, useCount);
      await reload();
    },
    [reload],
  );

  const addFee = useCallback(
    async (id: number, amount: number, remark?: string | null) => {
      await addAssetFee(id, amount, remark);
      await reload();
    },
    [reload],
  );

  const reorder = useCallback(
    async (orderedIds: number[]) => {
      await reorderAssets(orderedIds);
      await reload();
    },
    [reload],
  );

  return {
    assets,
    loading,
    reload,
    createOne,
    updateOne,
    deleteOne,
    updateStatus,
    updateUseCount,
    addFee,
    reorder,
    getAssetById,
  };
};
