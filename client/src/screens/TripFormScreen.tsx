import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useShallow } from "zustand/react/shallow";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { TripMoneyFields } from "../components/TripMoneyFields";
import { TripTimeFields } from "../components/TripTimeFields";
import { isDraftDirty } from "../domain/tripDraft";
import { useAppStore } from "../store/useAppStore";
import { colors, fontSize, radius, spacing } from "../theme";
import { formatDayTitle } from "../utils/format";

/**
 * Форма — слой на весь экран в основном окне, а не Modal: в шторке-Modal на
 * Android клавиатура закрывала поля. Кнопки закреплены внизу, вне прокрутки.
 * Одна форма на два случая: новая поездка и изменение существующей.
 */
export function TripFormScreen() {
  const insets = useSafeAreaInsets();
  const { isOpen, isEditing, date, isDirty, isSubmitting, submitMessage } = useAppStore(
    useShallow((state) => ({
      isOpen: state.isTripFormOpen,
      isEditing: state.formMode.kind === "edit",
      date: state.draft?.date ?? null,
      isDirty: state.draft && state.initialDraft ? isDraftDirty(state.draft, state.initialDraft) : false,
      isSubmitting: state.isSubmitting,
      submitMessage: state.submitMessage,
    }))
  );
  const closeTripForm = useAppStore((state) => state.closeTripForm);
  const submitDraft = useAppStore((state) => state.submitDraft);
  // Открыт ли вопрос «выйти без сохранения?» — забота экрана, а не данных
  const [isConfirmingClose, setIsConfirmingClose] = useState(false);

  useEffect(() => {
    if (!isOpen) setIsConfirmingClose(false);
  }, [isOpen]);

  /** Пустую или нетронутую форму закрываем сразу, иначе — спрашиваем. */
  const requestClose = useCallback(() => {
    if (isSubmitting) return;
    if (isDirty) {
      setIsConfirmingClose(true);
    } else {
      closeTripForm();
    }
  }, [isDirty, isSubmitting, closeTripForm]);
  const keepEditing = useCallback(() => setIsConfirmingClose(false), []);
  const discardAndClose = useCallback(() => {
    setIsConfirmingClose(false);
    closeTripForm();
  }, [closeTripForm]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (isConfirmingClose) {
        setIsConfirmingClose(false);
      } else {
        requestClose();
      }
      return true;
    });
    return () => subscription.remove();
  }, [isOpen, isConfirmingClose, requestClose]);

  const submit = useCallback(() => {
    void submitDraft();
  }, [submitDraft]);

  if (!isOpen || !date) return null;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.screen, { paddingTop: insets.top }]}
      accessibilityViewIsModal
    >
      <View style={styles.column}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>{isEditing ? "Изменить поездку" : "Новая поездка"}</Text>
            <Text style={styles.subtitle}>{formatDayTitle(date)}</Text>
          </View>
          <Pressable
            onPress={requestClose}
            disabled={isSubmitting}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="Закрыть"
          >
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          <TripTimeFields />
          <TripMoneyFields />
          {submitMessage ? (
            <View style={styles.messageBox} accessibilityLiveRegion="polite">
              <Text style={styles.messageText}>{submitMessage}</Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <Pressable
            onPress={requestClose}
            disabled={isSubmitting}
            style={[styles.button, styles.secondaryButton]}
          >
            <Text style={styles.secondaryButtonText}>Отмена</Text>
          </Pressable>
          <Pressable
            onPress={submit}
            disabled={isSubmitting}
            style={[styles.button, styles.primaryButton, isSubmitting && styles.buttonDisabled]}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.onAccent} />
            ) : (
              <Text style={styles.primaryButtonText}>Сохранить</Text>
            )}
          </Pressable>
        </View>
      </View>

      {isConfirmingClose ? (
        <ConfirmDialog
          title="Выйти без сохранения?"
          message={isEditing ? "Изменения не сохранятся." : "Введённые данные пропадут."}
          confirmLabel="Выйти"
          cancelLabel="Продолжить"
          destructive
          onConfirm={discardAndClose}
          onCancel={keepEditing}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.background,
  },
  column: {
    flex: 1,
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: "700",
    color: colors.text,
  },
  subtitle: {
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  closeText: {
    fontSize: fontSize.title,
    color: colors.text,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  messageBox: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  messageText: {
    fontSize: fontSize.body,
    color: colors.danger,
  },
  footer: {
    flexDirection: "row",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  button: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButton: {
    backgroundColor: colors.accent,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: colors.onAccent,
    fontSize: fontSize.body,
    fontWeight: "600",
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: fontSize.body,
    fontWeight: "600",
  },
});
