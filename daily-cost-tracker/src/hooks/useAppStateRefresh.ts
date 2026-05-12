import { useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import { refreshAllAssets } from "../db/assetRepository";

export const useAppStateRefresh = () => {
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener("change", async (nextState) => {
      if (appState.current !== "active" && nextState === "active") {
        await refreshAllAssets();
      }
      appState.current = nextState;
    });

    return () => {
      sub.remove();
    };
  }, []);
};
