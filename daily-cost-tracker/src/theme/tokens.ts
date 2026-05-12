import { Platform, ViewStyle } from "react-native";

export const tokens = {
  colors: {
    brandPrimary500: "#4E7CFF",
    brandPrimary300: "#8FB0FF",
    ocean700: "#2A3D75",
    ocean500: "#5E84D8",
    sky100: "#F2F7FF",
    accentMint400: "#72D8BF",

    // Backward compatible aliases for existing usages.
    brandSunset500: "#4E7CFF",
    brandSunset300: "#8FB0FF",
    accentGold400: "#72D8BF",

    neutral900: "#1A1E24",
    neutral700: "#4A5574",
    neutral500: "#7D89AB",
    neutral300: "#D3DCF0",
    neutral100: "#EDF3FF",

    white: "#FFFFFF",
    black: "#000000",
    error: "#EF4444",
    success: "#16A34A",
  },
  radius: {
    chip: 999,
    input: 14,
    button: 14,
    card: 18,
    cardLarge: 24,
    modal: 24,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
  },
  motion: {
    duration: {
      fast: 120,
      normal: 220,
      slow: 320,
    },
    easing: {
      oceanEaseOut: [0.22, 1, 0.36, 1] as const,
    },
  },
} as const;

type ShadowSize = "sm" | "md" | "lg";

const shadowPresets: Record<ShadowSize, { radius: number; y: number; opacity: number; elevation: number }> = {
  sm: { radius: 10, y: 3, opacity: 0.1, elevation: 3 },
  md: { radius: 16, y: 6, opacity: 0.12, elevation: 5 },
  lg: { radius: 22, y: 10, opacity: 0.14, elevation: 8 },
};

export const getShadow = (size: ShadowSize): ViewStyle => {
  const preset = shadowPresets[size];

  if (Platform.OS === "android") {
    return {
      elevation: preset.elevation,
      shadowColor: tokens.colors.ocean700,
    };
  }

  return {
    shadowColor: tokens.colors.ocean700,
    shadowOffset: { width: 0, height: preset.y },
    shadowOpacity: preset.opacity,
    shadowRadius: preset.radius,
  };
};
