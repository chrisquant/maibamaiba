type CostInput = {
  price: number;
  addFee: number;
  holdDays: number;
  useCount: number;
  sellPrice?: number;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

export const calcDailyCost = ({ price, addFee, holdDays }: CostInput) => {
  if (holdDays <= 0) {
    return null;
  }
  return round2((price + addFee) / holdDays);
};

export const calcNetDailyCost = ({
  price,
  addFee,
  holdDays,
  sellPrice = 0,
}: CostInput) => {
  if (holdDays <= 0) {
    return null;
  }
  return round2((price + addFee - sellPrice) / holdDays);
};

export const calcSingleUseCost = ({ price, addFee, useCount }: CostInput) => {
  if (useCount <= 0) {
    return null;
  }
  return round2((price + addFee) / useCount);
};

export const calcHoldDays = (buyTime: string, current = new Date()) => {
  const buyDate = new Date(buyTime);
  const start = new Date(
    buyDate.getFullYear(),
    buyDate.getMonth(),
    buyDate.getDate(),
  );
  const end = new Date(
    current.getFullYear(),
    current.getMonth(),
    current.getDate(),
  );
  const diffMs = end.getTime() - start.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
};
