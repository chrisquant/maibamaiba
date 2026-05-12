import { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";
import { colors } from "../../theme/colors";
import { getShadow, tokens } from "../../theme/tokens";

export const AppCard = ({ children }: PropsWithChildren) => {
  return <View style={[styles.card, getShadow("sm")]}>{children}</View>;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: tokens.radius.card,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(31, 58, 95, 0.1)",
  },
});
