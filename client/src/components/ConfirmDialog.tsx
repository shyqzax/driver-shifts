import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fontSize, radius, spacing } from "../theme";

interface ConfirmDialogProps {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Красная кнопка подтверждения — для действий, после которых данные пропадают */
  destructive?: boolean;
  isBusy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Своё окно вместо Alert.alert: системное подтверждение в веб-версии
 * react-native-web ничего не показывает, и действие выполнялось бы молча.
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive,
  isBusy,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <View style={styles.overlay} accessibilityViewIsModal>
      <Pressable style={styles.backdrop} onPress={onCancel} disabled={isBusy} accessibilityLabel={cancelLabel} />
      <View style={styles.card} accessibilityRole="alert">
        <Text style={styles.title}>{title}</Text>
        {message ? <Text style={styles.message}>{message}</Text> : null}
        <View style={styles.actions}>
          <Pressable
            onPress={onCancel}
            disabled={isBusy}
            style={[styles.button, styles.cancelButton]}
            accessibilityRole="button"
          >
            <Text style={styles.cancelText}>{cancelLabel}</Text>
          </Pressable>
          <Pressable
            onPress={onConfirm}
            disabled={isBusy}
            style={[styles.button, destructive ? styles.destructiveButton : styles.confirmButton]}
            accessibilityRole="button"
          >
            {isBusy ? (
              <ActivityIndicator color={colors.onAccent} />
            ) : (
              <Text style={styles.confirmText}>{confirmLabel}</Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  backdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(17, 24, 39, 0.5)",
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: "700",
    color: colors.text,
  },
  message: {
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.md,
  },
  button: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    backgroundColor: colors.background,
  },
  confirmButton: {
    backgroundColor: colors.accent,
  },
  destructiveButton: {
    backgroundColor: colors.danger,
  },
  cancelText: {
    fontSize: fontSize.body,
    fontWeight: "600",
    color: colors.text,
  },
  confirmText: {
    fontSize: fontSize.body,
    fontWeight: "600",
    color: colors.onAccent,
  },
});
