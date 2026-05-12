import { StyleSheet, Text, View } from "react-native";

type Props = {
  message: string;
};

export const AppToast = ({ message }: Props) => {
  return (
    <View style={styles.toast}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    bottom: 40,
    left: 16,
    right: 16,
    backgroundColor: "rgba(17, 24, 39, 0.95)",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  text: {
    color: "#fff",
    textAlign: "center",
  },
});
