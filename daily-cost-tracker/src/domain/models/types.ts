export type AssetStatus = 0 | 1 | 2 | 3;

export type Asset = {
  id: number;
  name: string;
  price: number;
  buyTime: string;
  category: string | null;
  image: string | null;
  addFee: number;
  useCount: number;
  warrantyTime: string | null;
  targetCost: number | null;
  status: AssetStatus;
  deactivatedAt: string | null;
  sellPrice: number;
  remark: string | null;
  holdDays: number;
  dailyCost: number;
  updatedAt: string | null;
  sortOrder?: number | null;
};

export type Category = {
  id: number;
  name: string;
  icon: string | null;
  isDefault: 0 | 1;
  sortOrder?: number | null;
};

export type Wish = {
  id: number;
  name: string;
  expectPrice: number | null;
  expectDays: number | null;
  expectDaily: number | null;
  level: number | null;
};

export type AddFeeItem = {
  id: number;
  assetId: number;
  amount: number;
  remark: string | null;
  createdAt: string | null;
};
