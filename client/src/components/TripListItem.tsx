import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, fontSize, radius, spacing } from "../theme";
import type { Trip } from "../types/api";
import { dayKeyInZone, formatDuration, formatMoney, formatTimeInZone } from "../utils/format";

interface TripListItemProps {
  trip: Trip;
  tzOffset: string;
}

const PAYMENT_LABELS = { cash: "Наличные", card: "Карта" } as const;

export const TripListItem = memo(function TripListItem({ trip, tzOffset }: TripListItemProps) {
  const start = formatTimeInZone(trip.start, tzOffset);
  const end = formatTimeInZone(trip.end, tzOffset);
  const endsNextDay = dayKeyInZone(trip.end, tzOffset) !== dayKeyInZone(trip.start, tzOffset);
  const isCash = trip.payment === "cash";

  return (
    <View style={styles.row}>
      <View style={styles.timeColumn}>
        <Text style={styles.time}>
          {start} – {end}
          {endsNextDay && <Text style={styles.nextDay}> +1 д</Text>}
        </Text>
        <Text style={styles.caption}>
          {formatDuration(trip.start, trip.end)} · комиссия {formatMoney(trip.commission)}
        </Text>
      </View>
      <View style={styles.amountColumn}>
        <Text style={styles.amount}>{formatMoney(trip.amount)}</Text>
        <View style={[styles.badge, isCash ? styles.cashBadge : styles.cardBadge]}>
          <Text style={[styles.badgeText, isCash ? styles.cashText : styles.cardText]}>
            {PAYMENT_LABELS[trip.payment]}
          </Text>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  timeColumn: {
    flex: 1,
    gap: 2,
  },
  time: {
    fontSize: fontSize.body,
    fontWeight: "600",
    color: colors.text,
  },
  nextDay: {
    fontSize: fontSize.caption,
    fontWeight: "400",
    color: colors.textMuted,
  },
  caption: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  amountColumn: {
    alignItems: "flex-end",
    gap: spacing.xs,
  },
  amount: {
    fontSize: fontSize.body,
    fontWeight: "600",
    color: colors.text,
  },
  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  cashBadge: {
    backgroundColor: colors.cashSoft,
  },
  cardBadge: {
    backgroundColor: colors.cardSoft,
  },
  badgeText: {
    fontSize: fontSize.caption,
    fontWeight: "600",
  },
  cashText: {
    color: colors.cash,
  },
  cardText: {
    color: colors.card,
  },
});
