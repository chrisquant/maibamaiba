import { createContext, PropsWithChildren, useContext, useMemo, useState } from "react";
import { Asset } from "../domain/models/types";

type AssetContextValue = {
  assets: Asset[];
  setAssets: (value: Asset[]) => void;
};

const AssetContext = createContext<AssetContextValue | undefined>(undefined);

export const AssetProvider = ({ children }: PropsWithChildren) => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const value = useMemo(() => ({ assets, setAssets }), [assets]);
  return <AssetContext.Provider value={value}>{children}</AssetContext.Provider>;
};

export const useAssetContext = () => {
  const context = useContext(AssetContext);
  if (!context) {
    throw new Error("useAssetContext 必须在 AssetProvider 中使用");
  }
  return context;
};
