import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { colors } from "../../theme/colors";
import { tokens } from "../../theme/tokens";

type Props = {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

export const AppButton = ({
  title,
  onPress,
  disabled = false,
  loading = false,
  variant = "primary",
}: Props) => {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => {
        if (variant === "danger") {
          return [
            styles.button,
            {
              backgroundColor: colors.error,
              opacity: pressed || isDisabled ? 0.8 : 1,
            },
          ];
        }

        if (variant === "secondary") {
          return [
            styles.button,
            styles.secondaryButton,
            {
              backgroundColor: isDisabled
                ? tokens.colors.neutral100
                : pressed
                  ? "rgba(31, 58, 95, 0.06)"
                  : tokens.colors.white,
            },
          ];
        }

        if (variant === "ghost") {
          return [
            styles.button,
            styles.ghostButton,
            {
              backgroundColor: pressed ? "rgba(31, 58, 95, 0.08)" : "transparent",
              opacity: isDisabled ? 0.6 : 1,
            },
          ];
        }

        return [
          styles.button,
          {
            backgroundColor: isDisabled
              ? tokens.colors.neutral300
              : pressed
                ? tokens.colors.brandPrimary300
                : colors.primary,
          },
        ];
      }}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "secondary" || variant === "ghost" ? colors.primary : "#ffffff"}
          size="small"
        />
      ) : (
        <Text
          style={[
            styles.text,
            variant === "secondary" || variant === "ghost" ? styles.secondaryText : styles.primaryText,
            isDisabled && (variant === "secondary" || variant === "ghost") ? styles.disabledText : undefined,
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    height: 44,
    borderRadius: tokens.radius.button,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: tokens.spacing.lg,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "rgba(31, 58, 95, 0.14)",
  },
  ghostButton: {
    borderWidth: 1,
    borderColor: "transparent",
  },
  text: {
    fontWeight: "600",
    fontSize: 15,
  },
  primaryText: {
    color: "#ffffff",
  },
  secondaryText: {
    color: colors.primary,
  },
  disabledText: {
    color: tokens.colors.neutral500,
  },
});
