import { useCallback, useEffect } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useShallow } from "zustand/react/shallow";
import { DayNavigator } from "../components/DayNavigator";
import { SummaryCard } from "../components/SummaryCard";
import { TripListItem } from "../components/TripListItem";
import { useAppStore } from "../store/useAppStore";
import { colors, fontSize, radius, spacing } from "../theme";
import type { DayReport, Trip } from "../types/api";

function keyOfTrip(trip: Trip): string {
  return trip.id;
}

function ListSeparator() {
  return <View style={styles.separator} />;
}

interface DayListHeaderProps {
  report: DayReport | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
}

function DayListHeader({ report, isLoading, error, onRetry }: DayListHeaderProps) {
  return (
    <View style={styles.listHeader}>
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={onRetry} style={styles.retryButton} accessibilityRole="button">
            <Text style={styles.retryText}>Повторить</Text>
          </Pressable>
        </View>
      ) : null}
      {isLoading && !report ? <ActivityIndicator color={colors.accent} style={styles.loader} /> : null}
      {report ? <SummaryCard summary={report.summary} /> : null}
      {report && report.trips.length > 0 ? <Text style={styles.sectionTitle}>Поездки</Text> : null}
    </View>
  );
}

function EmptyDay() {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>Поездок нет</Text>
      <Text style={styles.emptyText}>Выходной? Если поездка была — добавьте её кнопкой ниже.</Text>
    </View>
  );
}

export function DayScreen() {
  const insets = useSafeAreaInsets();
  const { days, selectedDate, dayReport, dayStatus, dayError } = useAppStore(
    useShallow((state) => ({
      days: state.days,
      selectedDate: state.selectedDate,
      dayReport: state.dayReport,
      dayStatus: state.dayStatus,
      dayError: state.dayError,
    }))
  );
  const loadInitialDay = useAppStore((state) => state.loadInitialDay);
  const selectDate = useAppStore((state) => state.selectDate);
  const shiftSelectedDate = useAppStore((state) => state.shiftSelectedDate);
  const reloadDay = useAppStore((state) => state.reloadDay);
  const openAddTrip = useAppStore((state) => state.openAddTrip);

  useEffect(() => {
    void loadInitialDay();
  }, [loadInitialDay]);

  const tzOffset = dayReport?.tzOffset ?? "+05:00";
  const renderTrip = useCallback(
    ({ item }: ListRenderItemInfo<Trip>) => <TripListItem trip={item} tzOffset={tzOffset} />,
    [tzOffset]
  );
  const handleShiftDay = useCallback((delta: number) => void shiftSelectedDate(delta), [shiftSelectedDate]);
  const handleSelectDay = useCallback((date: string) => void selectDate(date), [selectDate]);
  const handleRetry = useCallback(() => void reloadDay(), [reloadDay]);

  const isLoading = dayStatus === "loading";
  const canAddTrip = dayReport !== null && dayReport.date === selectedDate;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.column}>
        <Text style={styles.appTitle}>Дневник смен</Text>
        {selectedDate ? (
          <DayNavigator
            selectedDate={selectedDate}
            days={days}
            onShiftDay={handleShiftDay}
            onSelectDay={handleSelectDay}
          />
        ) : null}

        <FlatList
          style={styles.list}
          data={dayReport?.trips ?? []}
          keyExtractor={keyOfTrip}
          renderItem={renderTrip}
          ItemSeparatorComponent={ListSeparator}
          ListHeaderComponent={
            <DayListHeader report={dayReport} isLoading={isLoading} error={dayError} onRetry={handleRetry} />
          }
          ListEmptyComponent={dayReport ? EmptyDay : null}
          refreshing={isLoading && dayReport !== null}
          onRefresh={handleRetry}
          contentContainerStyle={styles.listContent}
        />

        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
          <Pressable
            onPress={openAddTrip}
            disabled={!canAddTrip}
            style={[styles.addButton, !canAddTrip && styles.addButtonDisabled]}
            accessibilityRole="button"
          >
            <Text style={styles.addButtonText}>+ Добавить поездку</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  column: {
    flex: 1,
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    paddingHorizontal: spacing.lg,
  },
  appTitle: {
    fontSize: fontSize.caption,
    fontWeight: "600",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: spacing.lg,
  },
  listHeader: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  loader: {
    marginVertical: spacing.xl,
  },
  sectionTitle: {
    fontSize: fontSize.body,
    fontWeight: "600",
    color: colors.text,
    marginTop: spacing.sm,
  },
  separator: {
    height: spacing.sm,
  },
  errorBox: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
  errorText: {
    fontSize: fontSize.body,
    color: colors.danger,
  },
  retryButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  retryText: {
    color: colors.text,
    fontWeight: "600",
  },
  empty: {
    alignItems: "center",
    paddingVertical: spacing.xl,
    gap: spacing.xs,
  },
  emptyTitle: {
    fontSize: fontSize.title,
    fontWeight: "600",
    color: colors.text,
  },
  emptyText: {
    fontSize: fontSize.body,
    color: colors.textMuted,
    textAlign: "center",
  },
  bottomBar: {
    paddingTop: spacing.md,
  },
  addButton: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  addButtonText: {
    color: colors.onAccent,
    fontSize: fontSize.body,
    fontWeight: "700",
  },
});
