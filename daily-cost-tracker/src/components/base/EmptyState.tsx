import { StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme/colors";

type Props = {
  title: string;
  description?: string;
};

export const EmptyState = ({ title, description }: Props) => {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>📭</Text>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 28,
  },
  emoji: {
    fontSize: 30,
  },
  title: {
    marginTop: 8,
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "600",
  },
  description: {
    marginTop: 6,
    color: colors.textSecondary,
    fontSize: 13,
  },
});
