export type RootTabParamList = {
  Home: undefined;
  Stats: undefined;
  Wish: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Tabs: undefined;
  AssetForm:
    | {
        assetId?: number;
        prefill?: {
          name: string;
          price: number;
        };
        sourceWishId?: number;
      }
    | undefined;
  AssetDetail: { assetId: number };
  CategoryManage: undefined;
  CategoryDetail: { categoryId: number };
};
