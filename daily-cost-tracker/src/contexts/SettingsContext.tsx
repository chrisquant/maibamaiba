import { createContext, PropsWithChildren, useContext, useMemo, useState } from "react";

type SettingsState = {
  warrantyNotificationEnabled: boolean;
};

type SettingsContextValue = SettingsState & {
  setWarrantyNotificationEnabled: (enabled: boolean) => void;
};

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export const SettingsProvider = ({ children }: PropsWithChildren) => {
  const [warrantyNotificationEnabled, setWarrantyNotificationEnabled] =
    useState(false);

  const value = useMemo(
    () => ({ warrantyNotificationEnabled, setWarrantyNotificationEnabled }),
    [warrantyNotificationEnabled],
  );

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
};

export const useSettingsContext = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettingsContext 必须在 SettingsProvider 中使用");
  }
  return context;
};
