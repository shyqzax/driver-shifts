import { StyleSheet, Text, View } from "react-native";
import { colors, fontSize, radius, spacing } from "../theme";
import type { DaySummary, PaymentBreakdown } from "../types/api";
import { formatMoney, pluralizeTrips } from "../utils/format";

interface SummaryCardProps {
  summary: DaySummary;
}

interface MetricProps {
  label: string;
  value: string;
}

function Metric({ label, value }: MetricProps) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

interface PaymentTileProps {
  label: string;
  breakdown: PaymentBreakdown;
  tone: "cash" | "card";
}

function PaymentTile({ label, breakdown, tone }: PaymentTileProps) {
  return (
    <View style={[styles.paymentTile, tone === "cash" ? styles.cashTile : styles.cardTile]}>
      <Text style={[styles.paymentLabel, tone === "cash" ? styles.cashText : styles.cardText]}>
        {label}
      </Text>
      <Text style={styles.paymentAmount}>{formatMoney(breakdown.amount)}</Text>
      <Text style={styles.paymentCount}>{pluralizeTrips(breakdown.count)}</Text>
    </View>
  );
}

export function SummaryCard({ summary }: SummaryCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.heroLabel}>На руки</Text>
      <Text style={styles.heroValue}>{formatMoney(summary.net)}</Text>
      <Text style={styles.tripsCount}>{pluralizeTrips(summary.tripsCount)}</Text>

      <View style={styles.metricsRow}>
        <Metric label="Выручка" value={formatMoney(summary.revenue)} />
        <Metric
          label="Комиссия"
          value={summary.commission > 0 ? `−${formatMoney(summary.commission)}` : formatMoney(0)}
        />
      </View>

      <View style={styles.paymentsRow}>
        <PaymentTile label="Наличные" breakdown={summary.byPayment.cash} tone="cash" />
        <PaymentTile label="Карта" breakdown={summary.byPayment.card} tone="card" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  heroLabel: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  heroValue: {
    fontSize: fontSize.hero,
    fontWeight: "700",
    color: colors.accent,
  },
  tripsCount: {
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  metricsRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.md,
  },
  metric: {
    flex: 1,
    gap: 2,
  },
  metricLabel: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  metricValue: {
    fontSize: fontSize.title,
    fontWeight: "600",
    color: colors.text,
  },
  paymentsRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.md,
  },
  paymentTile: {
    flex: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
  },
  cashTile: {
    backgroundColor: colors.cashSoft,
  },
  cardTile: {
    backgroundColor: colors.cardSoft,
  },
  paymentLabel: {
    fontSize: fontSize.caption,
    fontWeight: "600",
  },
  cashText: {
    color: colors.cash,
  },
  cardText: {
    color: colors.card,
  },
  paymentAmount: {
    fontSize: fontSize.body,
    fontWeight: "600",
    color: colors.text,
  },
  paymentCount: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
});
