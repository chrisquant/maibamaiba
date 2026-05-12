import { PropsWithChildren } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { colors } from "../../theme/colors";
import { getShadow, tokens } from "../../theme/tokens";

type Props = PropsWithChildren<{
  visible: boolean;
  title: string;
  onClose: () => void;
}>;

export const AppModal = ({ visible, title, onClose, children }: Props) => {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={[styles.content, getShadow("lg")]}>
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              <Pressable style={styles.close} onPress={onClose} hitSlop={8}>
                <Text style={styles.closeText}>关闭</Text>
              </Pressable>
            </View>
            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(12, 18, 28, 0.38)",
    padding: tokens.spacing.xl,
  },
  content: {
    backgroundColor: colors.card,
    borderRadius: tokens.radius.modal,
    padding: tokens.spacing.lg,
    maxHeight: "85%",
    borderWidth: 1,
    borderColor: "rgba(31, 58, 95, 0.1)",
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  body: {
    marginTop: tokens.spacing.sm,
    flexGrow: 0,
  },
  bodyContent: {
    paddingBottom: tokens.spacing.xs,
  },
  close: {
    paddingVertical: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.sm,
    borderRadius: tokens.radius.button,
    backgroundColor: "rgba(31, 58, 95, 0.08)",
  },
  closeText: {
    color: colors.primary,
    fontWeight: "600",
    fontSize: 12,
    lineHeight: 16,
  },
});
