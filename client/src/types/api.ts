/** Контракт API сервера (`server/src`). Копия небольшая, поэтому без общего пакета. */

export type PaymentMethod = "cash" | "card";

export interface Trip {
  id: string;
  start: string;
  end: string;
  amount: number;
  payment: PaymentMethod;
  commission: number;
}

export type TripField = keyof Trip;

export interface PaymentBreakdown {
  count: number;
  amount: number;
}

export interface DaySummary {
  tripsCount: number;
  revenue: number;
  commission: number;
  net: number;
  byPayment: Record<PaymentMethod, PaymentBreakdown>;
}

export interface BusyInterval {
  tripId: string;
  start: string;
  end: string;
}

export interface DayReport {
  date: string;
  tzOffset: string;
  summary: DaySummary;
  trips: Trip[];
  /** Занятое время в этот и следующий день — для выбора времени в форме */
  busy: BusyInterval[];
}

export interface DayOverview {
  date: string;
  tripsCount: number;
}

export interface AddTripResponse {
  trip: Trip;
  date: string;
  created: boolean;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  fields?: Partial<Record<string, string>>;
  existingTrip?: Trip;
  conflictingTrip?: Trip;
}
