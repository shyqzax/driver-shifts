import { useCallback } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useShallow } from "zustand/react/shallow";
import { suggestCommission } from "../domain/tripDraft";
import { useAppStore } from "../store/useAppStore";
import { colors, fontSize, radius, spacing } from "../theme";
import type { PaymentMethod } from "../types/api";

interface MoneyFieldProps {
  label: string;
  value: string;
  placeholder: string;
  error?: string;
  onChangeText: (text: string) => void;
}

function MoneyField({ label, value, placeholder, error, onChangeText }: MoneyFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType="decimal-pad"
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

export function TripMoneyFields() {
  const { amount, commission, payment, errors } = useAppStore(
    useShallow((state) => ({
      amount: state.draft?.amount ?? "",
      commission: state.draft?.commission ?? "",
      payment: state.draft?.payment ?? "card",
      errors: state.draftErrors,
    }))
  );
  const updateDraft = useAppStore((state) => state.updateDraft);

  const changeAmount = useCallback((text: string) => updateDraft({ amount: text }), [updateDraft]);
  const changeCommission = useCallback((text: string) => updateDraft({ commission: text }), [updateDraft]);
  const changePayment = useCallback((method: PaymentMethod) => updateDraft({ payment: method }), [updateDraft]);
  const fillSuggestedCommission = useCallback(() => {
    const suggestion = suggestCommission(useAppStore.getState().draft?.amount ?? "");
    if (suggestion !== null) updateDraft({ commission: suggestion });
  }, [updateDraft]);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <MoneyField
          label="Сумма, ₸"
          value={amount}
          placeholder="2400"
          error={errors.amount}
          onChangeText={changeAmount}
        />
        <View style={styles.field}>
          <MoneyField
            label="Комиссия, ₸"
            value={commission}
            placeholder="360"
            error={errors.commission}
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
          <PaymentOption method="cash" label="Наличные" isSelected={payment === "cash"} onSelect={changePayment} />
          <PaymentOption method="card" label="Карта" isSelected={payment === "card"} onSelect={changePayment} />
        </View>
        {errors.payment ? <Text style={styles.errorText}>{errors.payment}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
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
});
