import { memo, useCallback } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, fontSize, radius, spacing } from "../theme";
import type { DayOverview } from "../types/api";
import { formatDayChip, formatDayTitle } from "../utils/format";

interface DayNavigatorProps {
  selectedDate: string;
  days: readonly DayOverview[];
  onShiftDay: (deltaDays: number) => void;
  onSelectDay: (date: string) => void;
}

interface DayChipProps {
  day: DayOverview;
  isSelected: boolean;
  onSelectDay: (date: string) => void;
}

const DayChip = memo(function DayChip({ day, isSelected, onSelectDay }: DayChipProps) {
  const handlePress = useCallback(() => onSelectDay(day.date), [day.date, onSelectDay]);
  return (
    <Pressable
      onPress={handlePress}
      style={[styles.chip, isSelected && styles.chipSelected]}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
    >
      <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
        {formatDayChip(day.date)} · {day.tripsCount}
      </Text>
    </Pressable>
  );
});

export function DayNavigator({ selectedDate, days, onShiftDay, onSelectDay }: DayNavigatorProps) {
  const showPreviousDay = useCallback(() => onShiftDay(-1), [onShiftDay]);
  const showNextDay = useCallback(() => onShiftDay(1), [onShiftDay]);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Pressable
          onPress={showPreviousDay}
          style={styles.arrow}
          accessibilityRole="button"
          accessibilityLabel="Предыдущий день"
        >
          <Text style={styles.arrowText}>‹</Text>
        </Pressable>
        <Text style={styles.title}>{formatDayTitle(selectedDate)}</Text>
        <Pressable
          onPress={showNextDay}
          style={styles.arrow}
          accessibilityRole="button"
          accessibilityLabel="Следующий день"
        >
          <Text style={styles.arrowText}>›</Text>
        </Pressable>
      </View>
      {days.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {days.map((day) => (
            <DayChip
              key={day.date}
              day={day}
              isSelected={day.date === selectedDate}
              onSelectDay={onSelectDay}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  arrow: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  arrowText: {
    fontSize: 26,
    lineHeight: 28,
    color: colors.text,
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: "600",
    color: colors.text,
  },
  chips: {
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    fontSize: fontSize.caption,
    color: colors.text,
  },
  chipTextSelected: {
    color: colors.onAccent,
    fontWeight: "600",
  },
});
