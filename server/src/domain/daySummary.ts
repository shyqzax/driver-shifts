import { fromMinorUnits, toMinorUnits } from "./money";
import { PAYMENT_METHODS, type PaymentMethod, type Trip } from "./trip";

export interface PaymentBreakdown {
  count: number;
  amount: number;
}

export interface DaySummary {
  tripsCount: number;
  /** Сумма всех поездок */
  revenue: number;
  commission: number;
  /** «На руки»: выручка минус комиссия */
  net: number;
  byPayment: Record<PaymentMethod, PaymentBreakdown>;
}

interface MinorUnitTotals {
  revenue: number;
  commission: number;
  byPayment: Record<PaymentMethod, PaymentBreakdown>;
}

function emptyBreakdown(): Record<PaymentMethod, PaymentBreakdown> {
  return { cash: { count: 0, amount: 0 }, card: { count: 0, amount: 0 } };
}

function sumInMinorUnits(trips: readonly Trip[]): MinorUnitTotals {
  const totals: MinorUnitTotals = { revenue: 0, commission: 0, byPayment: emptyBreakdown() };
  for (const trip of trips) {
    const amount = toMinorUnits(trip.amount);
    totals.revenue += amount;
    totals.commission += toMinorUnits(trip.commission);
    totals.byPayment[trip.payment].count += 1;
    totals.byPayment[trip.payment].amount += amount;
  }
  return totals;
}

export function computeDaySummary(trips: readonly Trip[]): DaySummary {
  const totals = sumInMinorUnits(trips);
  const byPayment = emptyBreakdown();
  for (const method of PAYMENT_METHODS) {
    byPayment[method] = {
      count: totals.byPayment[method].count,
      amount: fromMinorUnits(totals.byPayment[method].amount),
    };
  }
  return {
    tripsCount: trips.length,
    revenue: fromMinorUnits(totals.revenue),
    commission: fromMinorUnits(totals.commission),
    net: fromMinorUnits(totals.revenue - totals.commission),
    byPayment,
  };
}
