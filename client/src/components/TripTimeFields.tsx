import { useCallback } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useShallow } from "zustand/react/shallow";
import { maskTimeInput } from "../domain/timeInput";
import { useTripTimeCheck } from "../hooks/useTripTimeCheck";
import { useAppStore } from "../store/useAppStore";
import { colors, fontSize, radius, spacing } from "../theme";

interface TimeFieldProps {
  label: string;
  value: string;
  placeholder: string;
  error?: string;
  hint?: string;
  onChange: (value: string) => void;
}

/** Поле времени: вводятся только цифры, двоеточие после часов ставится само. */
function TimeField({ label, value, placeholder, error, hint, onChange }: TimeFieldProps) {
  const handleChangeText = useCallback((raw: string) => onChange(maskTimeInput(raw, value)), [onChange, value]);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={handleChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType="number-pad"
        maxLength={5}
        style={[styles.input, error ? styles.inputInvalid : null]}
        accessibilityLabel={label}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {!error && hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function TripTimeFields() {
  const { startTime, endTime, endsNextDay, serverStartError, serverEndError } = useAppStore(
    useShallow((state) => ({
      startTime: state.draft?.startTime ?? "",
      endTime: state.draft?.endTime ?? "",
      endsNextDay: state.draft?.endsNextDay ?? false,
      serverStartError: state.draftErrors.start,
      serverEndError: state.draftErrors.end,
    }))
  );
  const updateDraft = useAppStore((state) => state.updateDraft);
  const timeCheck = useTripTimeCheck();

  const changeStart = useCallback((value: string) => updateDraft({ startTime: value }), [updateDraft]);
  const changeEnd = useCallback((value: string) => updateDraft({ endTime: value }), [updateDraft]);
  const toggleEndsNextDay = useCallback(
    () => updateDraft({ endsNextDay: !useAppStore.getState().draft?.endsNextDay }),
    [updateDraft]
  );

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <TimeField
          label="Начало"
          value={startTime}
          placeholder="08:10"
          error={timeCheck.errors.start ?? serverStartError}
          onChange={changeStart}
        />
        <TimeField
          label="Окончание"
          value={endTime}
          placeholder="08:32"
          error={timeCheck.errors.end ?? serverEndError}
          hint={timeCheck.endHint}
          onChange={changeEnd}
        />
      </View>

      <Pressable
        onPress={toggleEndsNextDay}
        style={styles.checkboxRow}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: endsNextDay }}
      >
        <View style={[styles.checkbox, endsNextDay && styles.checkboxChecked]}>
          {endsNextDay ? <Text style={styles.checkmark}>✓</Text> : null}
        </View>
        <Text style={styles.checkboxLabel}>Закончилась после полуночи</Text>
      </Pressable>
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
    fontSize: fontSize.title,
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
  hint: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
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
});
