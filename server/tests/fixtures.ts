import type { Trip } from "../src/domain/trip";

/** Поездки t1 и t2 — дословно из условия задания. */
export const TASK_EXAMPLE_TRIPS: readonly Trip[] = [
  {
    id: "t1",
    start: "2026-10-01T08:10:00+05:00",
    end: "2026-10-01T08:32:00+05:00",
    amount: 2400,
    payment: "card",
    commission: 360,
  },
  {
    id: "t2",
    start: "2026-10-01T09:05:00+05:00",
    end: "2026-10-01T09:20:00+05:00",
    amount: 1500,
    payment: "cash",
    commission: 225,
  },
];

export function makeTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: "trip-1",
    start: "2026-10-01T10:00:00+05:00",
    end: "2026-10-01T10:30:00+05:00",
    amount: 2000,
    payment: "card",
    commission: 300,
    ...overrides,
  };
}

export const BUSINESS_TZ_OFFSET_MINUTES = 5 * 60;
