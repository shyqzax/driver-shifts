import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, BackHandler, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useShallow } from "zustand/react/shallow";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { netOfTrip } from "../domain/tripDraft";
import { useAppStore } from "../store/useAppStore";
import { colors, fontSize, radius, spacing } from "../theme";
import type { Trip } from "../types/api";
import {
  dayKeyInZone,
  formatDayTitle,
  formatDuration,
  formatMoney,
  formatTimeInZone,
} from "../utils/format";

const PAYMENT_LABELS = { cash: "Наличные", card: "Карта" } as const;

interface DetailRowProps {
  label: string;
  value: string;
  isAccent?: boolean;
}

function DetailRow({ label, value, isAccent }: DetailRowProps) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, isAccent && styles.detailValueAccent]}>{value}</Text>
    </View>
  );
}

function describeTime(trip: Trip, tzOffset: string): string {
  const start = formatTimeInZone(trip.start, tzOffset);
  const end = formatTimeInZone(trip.end, tzOffset);
  const nextDay = dayKeyInZone(trip.end, tzOffset) !== dayKeyInZone(trip.start, tzOffset) ? " (+1 д)" : "";
  return `${start} – ${end}${nextDay}`;
}

export function TripDetailsSheet() {
  const insets = useSafeAreaInsets();
  const { trip, tzOffset, isDeleting, message } = useAppStore(
    useShallow((state) => ({
      trip: state.viewedTripId
        ? (state.dayReport?.trips.find((candidate) => candidate.id === state.viewedTripId) ?? null)
        : null,
      tzOffset: state.dayReport?.tzOffset ?? "+05:00",
      isDeleting: state.isDeletingTrip,
      message: state.detailsMessage,
    }))
  );
  const closeTripDetails = useAppStore((state) => state.closeTripDetails);
  const editViewedTrip = useAppStore((state) => state.editViewedTrip);
  const deleteViewedTrip = useAppStore((state) => state.deleteViewedTrip);
  // Открыт ли вопрос «удалить?» — забота экрана, а не данных
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const isOpen = trip !== null;

  useEffect(() => {
    if (!isOpen) setIsConfirmingDelete(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (isConfirmingDelete) {
        setIsConfirmingDelete(false);
      } else {
        closeTripDetails();
      }
      return true;
    });
    return () => subscription.remove();
  }, [isOpen, isConfirmingDelete, closeTripDetails]);

  const askToDelete = useCallback(() => setIsConfirmingDelete(true), []);
  const cancelDelete = useCallback(() => setIsConfirmingDelete(false), []);
  const confirmDelete = useCallback(() => {
    setIsConfirmingDelete(false);
    void deleteViewedTrip();
  }, [deleteViewedTrip]);

  if (!trip) return null;

  const timeText = describeTime(trip, tzOffset);

  return (
    <View style={styles.overlay} accessibilityViewIsModal>
      <Pressable style={styles.backdrop} onPress={closeTripDetails} accessibilityLabel="Закрыть" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.subtitle}>{formatDayTitle(dayKeyInZone(trip.start, tzOffset))}</Text>
            <Text style={styles.title}>{timeText}</Text>
            <Text style={styles.subtitle}>{formatDuration(trip.start, trip.end)}</Text>
          </View>
          <Pressable
            onPress={closeTripDetails}
            disabled={isDeleting}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="Закрыть"
          >
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>

        <View style={styles.details}>
          <DetailRow label="Сумма" value={formatMoney(trip.amount)} />
          <DetailRow label="Комиссия" value={formatMoney(trip.commission)} />
          <DetailRow label="На руки" value={formatMoney(netOfTrip(trip))} isAccent />
          <DetailRow label="Оплата" value={PAYMENT_LABELS[trip.payment]} />
        </View>

        {message ? (
          <View style={styles.messageBox} accessibilityLiveRegion="polite">
            <Text style={styles.messageText}>{message}</Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          <Pressable
            onPress={editViewedTrip}
            disabled={isDeleting}
            style={[styles.button, styles.editButton]}
            accessibilityRole="button"
          >
            <Text style={styles.editText}>Редактировать</Text>
          </Pressable>
          <Pressable
            onPress={askToDelete}
            disabled={isDeleting}
            style={[styles.button, styles.deleteButton]}
            accessibilityRole="button"
          >
            {isDeleting ? <ActivityIndicator color={colors.danger} /> : <Text style={styles.deleteText}>Удалить</Text>}
          </Pressable>
        </View>
      </View>

      {isConfirmingDelete ? (
        <ConfirmDialog
          title="Удалить поездку?"
          message={`${timeText} на ${formatMoney(trip.amount)}. Отменить удаление будет нельзя.`}
          confirmLabel="Удалить"
          cancelLabel="Оставить"
          destructive
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
        />
      ) : null}
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
    justifyContent: "flex-end",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(17, 24, 39, 0.45)",
  },
  sheet: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: fontSize.hero - 8,
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
  details: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
  },
  detailLabel: {
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  detailValue: {
    fontSize: fontSize.body,
    fontWeight: "600",
    color: colors.text,
  },
  detailValueAccent: {
    color: colors.accent,
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
  },
  button: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  editButton: {
    backgroundColor: colors.accent,
  },
  editText: {
    fontSize: fontSize.body,
    fontWeight: "600",
    color: colors.onAccent,
  },
  deleteButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  deleteText: {
    fontSize: fontSize.body,
    fontWeight: "600",
    color: colors.danger,
  },
});
