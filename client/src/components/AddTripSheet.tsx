import { useCallback } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useShallow } from "zustand/react/shallow";
import { suggestCommission } from "../domain/tripDraft";
import { useAppStore } from "../store/useAppStore";
import { colors, fontSize, radius, spacing } from "../theme";
import type { PaymentMethod } from "../types/api";
import { formatDayTitle } from "../utils/format";

const TIME_KEYBOARD: KeyboardTypeOptions = Platform.select({
  ios: "numbers-and-punctuation",
  default: "numeric",
});

interface FormFieldProps {
  label: string;
  value: string;
  placeholder: string;
  error?: string;
  keyboardType: KeyboardTypeOptions;
  maxLength?: number;
  onChangeText: (text: string) => void;
}

function FormField({ label, value, placeholder, error, keyboardType, maxLength, onChangeText }: FormFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType}
        maxLength={maxLength}
        style={[styles.input, error ? styles.inputInvalid : null]}
        accessibilityLabel={label}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

interface PaymentOptionProps {
  method: PaymentMethod;
  label: string;
  isSelected: boolean;
  onSelect: (method: PaymentMethod) => void;
}

function PaymentOption({ method, label, isSelected, onSelect }: PaymentOptionProps) {
  const handlePress = useCallback(() => onSelect(method), [method, onSelect]);
  return (
    <Pressable
      onPress={handlePress}
      style={[styles.segment, isSelected && styles.segmentSelected]}
      accessibilityRole="radio"
      accessibilityState={{ selected: isSelected }}
    >
      <Text style={[styles.segmentText, isSelected && styles.segmentTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export function AddTripSheet() {
  const insets = useSafeAreaInsets();
  const { isOpen, draft, draftErrors, isSubmitting, submitMessage } = useAppStore(
    useShallow((state) => ({
      isOpen: state.isAddTripOpen,
      draft: state.draft,
      draftErrors: state.draftErrors,
      isSubmitting: state.isSubmitting,
      submitMessage: state.submitMessage,
    }))
  );
  const updateDraft = useAppStore((state) => state.updateDraft);
  const closeAddTrip = useAppStore((state) => state.closeAddTrip);
  const submitDraft = useAppStore((state) => state.submitDraft);

  const changeStartTime = useCallback((startTime: string) => updateDraft({ startTime }), [updateDraft]);
  const changeEndTime = useCallback((endTime: string) => updateDraft({ endTime }), [updateDraft]);
  const changeAmount = useCallback((amount: string) => updateDraft({ amount }), [updateDraft]);
  const changeCommission = useCallback((commission: string) => updateDraft({ commission }), [updateDraft]);
  const changePayment = useCallback((payment: PaymentMethod) => updateDraft({ payment }), [updateDraft]);
  const toggleEndsNextDay = useCallback(
    () => updateDraft({ endsNextDay: !useAppStore.getState().draft?.endsNextDay }),
    [updateDraft]
  );
  const fillSuggestedCommission = useCallback(() => {
    const suggestion = suggestCommission(useAppStore.getState().draft?.amount ?? "");
    if (suggestion !== null) updateDraft({ commission: suggestion });
  }, [updateDraft]);
  const submit = useCallback(() => {
    void submitDraft();
  }, [submitDraft]);

  if (!draft) return null;

  return (
    <Modal visible={isOpen} transparent animationType="slide" onRequestClose={closeAddTrip}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.backdrop}
      >
        <Pressable style={styles.backdropTap} onPress={closeAddTrip} accessibilityLabel="Закрыть" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <Text style={styles.title}>Новая поездка</Text>
            <Text style={styles.subtitle}>{formatDayTitle(draft.date)}</Text>

            <View style={styles.row}>
              <FormField
                label="Начало"
                value={draft.startTime}
                placeholder="08:10"
                error={draftErrors.startTime}
                keyboardType={TIME_KEYBOARD}
                maxLength={5}
                onChangeText={changeStartTime}
              />
              <FormField
                label="Окончание"
                value={draft.endTime}
                placeholder="08:32"
                error={draftErrors.endTime}
                keyboardType={TIME_KEYBOARD}
                maxLength={5}
                onChangeText={changeEndTime}
              />
            </View>

            <Pressable
              onPress={toggleEndsNextDay}
              style={styles.checkboxRow}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: draft.endsNextDay }}
            >
              <View style={[styles.checkbox, draft.endsNextDay && styles.checkboxChecked]}>
                {draft.endsNextDay ? <Text style={styles.checkmark}>✓</Text> : null}
              </View>
              <Text style={styles.checkboxLabel}>Закончилась после полуночи</Text>
            </Pressable>

            <View style={styles.row}>
              <FormField
                label="Сумма, ₸"
                value={draft.amount}
                placeholder="2400"
                error={draftErrors.amount}
                keyboardType="decimal-pad"
                onChangeText={changeAmount}
              />
              <View style={styles.commissionColumn}>
                <FormField
                  label="Комиссия, ₸"
                  value={draft.commission}
                  placeholder="360"
                  error={draftErrors.commission}
                  keyboardType="decimal-pad"
                  onChangeText={changeCommission}
                />
                <Pressable onPress={fillSuggestedCommission} style={styles.hintButton}>
                  <Text style={styles.hintButtonText}>Посчитать 15%</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Оплата</Text>
              <View style={styles.segments} accessibilityRole="radiogroup">
                <PaymentOption
                  method="cash"
                  label="Наличные"
                  isSelected={draft.payment === "cash"}
                  onSelect={changePayment}
                />
                <PaymentOption
                  method="card"
                  label="Карта"
                  isSelected={draft.payment === "card"}
                  onSelect={changePayment}
                />
              </View>
              {draftErrors.payment ? <Text style={styles.errorText}>{draftErrors.payment}</Text> : null}
            </View>

            {submitMessage ? (
              <View style={styles.messageBox} accessibilityLiveRegion="polite">
                <Text style={styles.messageText}>{submitMessage}</Text>
              </View>
            ) : null}

            <View style={styles.actions}>
              <Pressable
                onPress={closeAddTrip}
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
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(17, 24, 39, 0.45)",
  },
  backdropTap: {
    flex: 1,
  },
  sheet: {
    width: "100%",
    maxWidth: 560,
    maxHeight: "90%",
    alignSelf: "center",
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: "700",
    color: colors.text,
  },
  subtitle: {
    fontSize: fontSize.body,
    color: colors.textMuted,
    marginTop: -spacing.sm,
  },
  row: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
  },
  field: {
    flex: 1,
    gap: spacing.xs,
  },
  commissionColumn: {
    flex: 1,
    gap: spacing.xs,
  },
  label: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.body,
    color: colors.text,
    minHeight: 44,
  },
  inputInvalid: {
    borderColor: colors.danger,
  },
  errorText: {
    fontSize: fontSize.caption,
    color: colors.danger,
  },
  hintButton: {
    alignSelf: "flex-start",
    paddingVertical: spacing.xs,
  },
  hintButtonText: {
    fontSize: fontSize.caption,
    color: colors.accent,
    fontWeight: "600",
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.textMuted,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  checkboxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkmark: {
    color: colors.onAccent,
    fontSize: 14,
    fontWeight: "700",
  },
  checkboxLabel: {
    fontSize: fontSize.body,
    color: colors.text,
  },
  segments: {
    flexDirection: "row",
    backgroundColor: colors.border,
    borderRadius: radius.sm,
    padding: 2,
  },
  segment: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderRadius: radius.sm - 2,
  },
  segmentSelected: {
    backgroundColor: colors.surface,
  },
  segmentText: {
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  segmentTextSelected: {
    color: colors.text,
    fontWeight: "600",
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
  actions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.sm,
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
