import { minutesToMs, parseInstant } from "./time";
import type { Trip } from "./trip";

/** Календарный день в поясе бизнеса: `YYYY-MM-DD`. */
export type DayKey = string;

const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function dayKeyOf(instantMs: number, tzOffsetMinutes: number): DayKey {
  return new Date(instantMs + minutesToMs(tzOffsetMinutes)).toISOString().slice(0, 10);
}

/** Полночь дня `dayKey` по часам бизнеса — момент в миллисекундах. */
export function dayStartMs(dayKey: DayKey, tzOffsetMinutes: number): number {
  return Date.parse(`${dayKey}T00:00:00Z`) - minutesToMs(tzOffsetMinutes);
}

export function isValidDayKey(text: string): boolean {
  if (!DAY_KEY_PATTERN.test(text)) return false;
  // Несуществующая дата (2026-02-30) после разбора «перетекает» в другой день
  const parsed = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text;
}

export interface TripInterval {
  startMs: number;
  endMs: number;
}

/**
 * Хранилище принимает только проверенные поездки, поэтому неразборчивая дата
 * здесь — нарушение инварианта, а не пользовательская ошибка.
 */
export function tripInterval(trip: Trip): TripInterval {
  const startMs = parseInstant(trip.start);
  const endMs = parseInstant(trip.end);
  if (startMs === null || endMs === null) {
    throw new Error(`Поездка ${trip.id} хранится с неразборчивой датой`);
  }
  return { startMs, endMs };
}

/**
 * Поездка относится к дню, в который НАЧАЛАСЬ, по часам бизнеса. Поездка через
 * полночь не делится на два дня: заказ один, деньги за него пришли один раз.
 */
export function tripDayKey(trip: Trip, tzOffsetMinutes: number): DayKey {
  return dayKeyOf(tripInterval(trip).startMs, tzOffsetMinutes);
}
