export const PAYMENT_METHODS = ["cash", "card"] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Поездка в том виде, в каком её присылает клиент, хранит и отдаёт сервер. */
export interface Trip {
  id: string;
  /** ISO 8601 с явным часовым поясом, например `2026-10-01T08:10:00+05:00` */
  start: string;
  end: string;
  amount: number;
  payment: PaymentMethod;
  commission: number;
}

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === "string" && (PAYMENT_METHODS as readonly string[]).includes(value);
}
