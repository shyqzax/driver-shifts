import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { dayOffsetOf, formatClockTime, groupByHour, type HourGroup } from "../domain/freeTime";
import { colors, fontSize, radius, spacing } from "../theme";

interface TimePickerProps {
  label: string;
  value: number | null;
  /** Только свободные минуты: занятые сюда не попадают вовсе */
  options: readonly number[];
  isOpen: boolean;
  placeholder: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  /** Час, который раскрыть сразу, пока время не выбрано */
  suggestedHour?: number;
  onToggle: () => void;
  onChange: (minuteValue: number) => void;
}

interface ChipProps {
  value: number;
  label: string;
  isSelected: boolean;
  onSelect: (value: number) => void;
}

const Chip = memo(function Chip({ value, label, isSelected, onSelect }: ChipProps) {
  const handlePress = useCallback(() => onSelect(value), [value, onSelect]);
  return (
    <Pressable
      onPress={handlePress}
      style={[styles.chip, isSelected && styles.chipSelected]}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
    >
      <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
});

function describeValue(value: number): string {
  return dayOffsetOf(value) > 0 ? `${formatClockTime(value)} (+1 д)` : formatClockTime(value);
}

function hourLabel(hour: number): string {
  return String(hour % 24).padStart(2, "0");
}

interface HourRowProps {
  title?: string;
  groups: readonly HourGroup[];
  activeHour: number | null;
  onSelectHour: (hour: number) => void;
}

function HourRow({ title, groups, activeHour, onSelectHour }: HourRowProps) {
  if (groups.length === 0) return null;
  return (
    <View style={styles.section}>
      {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
      <View style={styles.grid}>
        {groups.map((group) => (
          <Chip
            key={group.hour}
            value={group.hour}
            label={hourLabel(group.hour)}
            isSelected={group.hour === activeHour}
            onSelect={onSelectHour}
          />
        ))}
      </View>
    </View>
  );
}

export function TimePicker({
  label,
  value,
  options,
  isOpen,
  placeholder,
  hint,
  error,
  disabled,
  suggestedHour,
  onToggle,
  onChange,
}: TimePickerProps) {
  const groups = useMemo(() => groupByHour(options), [options]);
  const [pickedHour, setPickedHour] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) setPickedHour(null);
  }, [isOpen]);

  const activeHour = pickedHour ?? (value !== null ? Math.floor(value / 60) : (suggestedHour ?? null));
  const activeGroup = groups.find((group) => group.hour === activeHour);
  const sameDayGroups = groups.filter((group) => group.hour < 24);
  const nextDayGroups = groups.filter((group) => group.hour >= 24);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={onToggle}
        disabled={disabled}
        style={[styles.field, error ? styles.fieldInvalid : null, disabled && styles.fieldDisabled]}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: isOpen, disabled }}
      >
        <Text style={value === null ? styles.placeholder : styles.value}>
          {value === null ? placeholder : describeValue(value)}
        </Text>
        <Text style={styles.chevron}>{isOpen ? "▴" : "▾"}</Text>
      </Pressable>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {isOpen ? (
        <View style={styles.panel}>
          {groups.length === 0 ? <Text style={styles.hint}>Свободного времени нет</Text> : null}
          <HourRow
            title={nextDayGroups.length > 0 ? "Час" : undefined}
            groups={sameDayGroups}
            activeHour={activeHour}
            onSelectHour={setPickedHour}
          />
          <HourRow
            title="Час после полуночи"
            groups={nextDayGroups}
            activeHour={activeHour}
            onSelectHour={setPickedHour}
          />
          {activeGroup ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Минуты, {hourLabel(activeGroup.hour)} ч</Text>
              <View style={styles.grid}>
                {activeGroup.minutes.map((minuteValue) => (
                  <Chip
                    key={minuteValue}
                    value={minuteValue}
                    label={formatClockTime(minuteValue).slice(3)}
                    isSelected={minuteValue === value}
                    onSelect={onChange}
                  />
                ))}
              </View>
            </View>
          ) : groups.length > 0 ? (
            <Text style={styles.hint}>Выберите час</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  label: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  field: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
  },
  fieldInvalid: {
    borderColor: colors.danger,
  },
  fieldDisabled: {
    opacity: 0.5,
  },
  value: {
    fontSize: fontSize.body,
    color: colors.text,
    fontWeight: "600",
  },
  placeholder: {
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  chevron: {
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  hint: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  errorText: {
    fontSize: fontSize.caption,
    color: colors.danger,
  },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.caption,
    fontWeight: "600",
    color: colors.textMuted,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    minWidth: 44,
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
  },
  chipSelected: {
    backgroundColor: colors.accent,
  },
  chipText: {
    fontSize: fontSize.body,
    color: colors.text,
  },
  chipTextSelected: {
    color: colors.onAccent,
    fontWeight: "600",
  },
});
