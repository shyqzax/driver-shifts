import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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
  /** Час, который показать первым, пока время не выбрано */
  suggestedHour?: number;
  onToggle: () => void;
  onChange: (minuteValue: number) => void;
}

interface ColumnItem {
  key: number;
  label: string;
  caption?: string;
}

/** Высота строки и число видимых строк: колонка занимает 200 пикселей, а не весь экран. */
const ROW_HEIGHT = 40;
const VISIBLE_ROWS = 5;

interface ColumnRowProps {
  item: ColumnItem;
  isSelected: boolean;
  onSelect: (key: number) => void;
}

const ColumnRow = memo(function ColumnRow({ item, isSelected, onSelect }: ColumnRowProps) {
  const handlePress = useCallback(() => onSelect(item.key), [item.key, onSelect]);
  return (
    <Pressable
      onPress={handlePress}
      style={[styles.row, isSelected && styles.rowSelected]}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
    >
      <Text style={[styles.rowText, isSelected && styles.rowTextSelected]}>{item.label}</Text>
      {item.caption ? (
        <Text style={[styles.rowCaption, isSelected && styles.rowTextSelected]}>{item.caption}</Text>
      ) : null}
    </Pressable>
  );
});

interface ScrollColumnProps {
  title: string;
  items: readonly ColumnItem[];
  selectedKey: number | null;
  emptyText: string;
  onSelect: (key: number) => void;
}

/**
 * Колонка сама прокручивается так, чтобы выбранная строка оказалась посередине.
 * Первый раз — когда строки уже разложены (onContentSizeChange): раньше
 * прокрутка уходит в пустоту. Дальше — при каждой смене выбора.
 */
function ScrollColumn({ title, items, selectedKey, emptyText, onSelect }: ScrollColumnProps) {
  const scrollRef = useRef<ScrollView>(null);
  const hasScrolled = useRef(false);
  const selectedIndex = items.findIndex((item) => item.key === selectedKey);
  const targetY = selectedIndex >= 0 ? Math.max(0, (selectedIndex - Math.floor(VISIBLE_ROWS / 2)) * ROW_HEIGHT) : 0;

  const scrollToSelection = useCallback(
    (animated: boolean) => scrollRef.current?.scrollTo({ y: targetY, animated }),
    [targetY]
  );

  useEffect(() => {
    // При открытии — сразу на место, без анимации; дальше при смене выбора — плавно
    const animated = hasScrolled.current;
    hasScrolled.current = true;
    const timer = setTimeout(() => scrollToSelection(animated), 0);
    return () => clearTimeout(timer);
  }, [scrollToSelection, items]);

  const handleContentSizeChange = useCallback(() => scrollToSelection(false), [scrollToSelection]);

  return (
    <View style={styles.column}>
      <Text style={styles.columnTitle}>{title}</Text>
      <ScrollView
        ref={scrollRef}
        style={styles.columnScroll}
        nestedScrollEnabled
        showsVerticalScrollIndicator
        onContentSizeChange={handleContentSizeChange}
      >
        {items.length === 0 ? <Text style={styles.emptyText}>{emptyText}</Text> : null}
        {items.map((item) => (
          <ColumnRow key={item.key} item={item} isSelected={item.key === selectedKey} onSelect={onSelect} />
        ))}
      </ScrollView>
    </View>
  );
}

function describeValue(value: number): string {
  return dayOffsetOf(value) > 0 ? `${formatClockTime(value)} (+1 д)` : formatClockTime(value);
}

/** Если подсказанный час целиком занят — ближайший свободный после него. */
function nearestGroup(groups: readonly HourGroup[], hour: number | null): HourGroup | undefined {
  if (hour === null) return undefined;
  return groups.find((group) => group.hour >= hour) ?? groups[groups.length - 1];
}

function toHourItem(group: HourGroup): ColumnItem {
  return {
    key: group.hour,
    label: String(group.hour % 24).padStart(2, "0"),
    caption: group.hour >= 24 ? "+1 д" : undefined,
  };
}

function toMinuteItem(minuteValue: number): ColumnItem {
  return { key: minuteValue, label: formatClockTime(minuteValue).slice(3) };
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

  const preferredHour = pickedHour ?? (value !== null ? Math.floor(value / 60) : (suggestedHour ?? null));
  const activeGroup = nearestGroup(groups, preferredHour);
  const hourItems = useMemo(() => groups.map(toHourItem), [groups]);
  const minuteItems = useMemo(() => (activeGroup ? activeGroup.minutes.map(toMinuteItem) : []), [activeGroup]);
  const selectedMinute = value !== null && activeGroup?.minutes.includes(value) ? value : null;

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
          <ScrollColumn
            title="Час"
            items={hourItems}
            selectedKey={activeGroup?.hour ?? null}
            emptyText="Свободного времени нет"
            onSelect={setPickedHour}
          />
          <ScrollColumn
            title="Минуты"
            items={minuteItems}
            selectedKey={selectedMinute}
            emptyText="Выберите час"
            onSelect={onChange}
          />
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
    flexDirection: "row",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  column: {
    flex: 1,
    gap: spacing.xs,
  },
  columnTitle: {
    fontSize: fontSize.caption,
    fontWeight: "600",
    color: colors.textMuted,
    textAlign: "center",
  },
  columnScroll: {
    height: ROW_HEIGHT * VISIBLE_ROWS,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
  },
  row: {
    height: ROW_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderRadius: radius.sm,
  },
  rowSelected: {
    backgroundColor: colors.accent,
  },
  rowText: {
    fontSize: fontSize.title,
    color: colors.text,
  },
  rowCaption: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  rowTextSelected: {
    color: colors.onAccent,
    fontWeight: "600",
  },
  emptyText: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
    textAlign: "center",
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
});
