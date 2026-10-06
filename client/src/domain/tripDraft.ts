import type { PaymentMethod, Trip, TripChanges } from "../types/api";
import { addDays, dayKeyInZone } from "../utils/format";
import { dayOffsetOf, dayStartMsOf, formatClockTime } from "./freeTime";

/** Форма добавления. Время — минуты от полуночи выбранного дня (см. freeTime). */
export interface TripDraft {
  /** Номер поездки придумывается один раз при открытии формы — повторная отправка шлёт его же */
  id: string;
  date: string;
  startMinute: number | null;
  endMinute: number | null;
  amount: string;
  commission: string;
  payment: PaymentMethod;
}

export type DraftField = "start" | "end" | "amount" | "commission" | "payment";
export type DraftErrors = Partial<Record<DraftField, string>>;

export type DraftBuildResult = { ok: true; trip: Trip } | { ok: false; errors: DraftErrors };

const DEFAULT_COMMISSION_RATE = 0.15;

const DRAFT_FIELDS: readonly DraftField[] = ["start", "end", "amount", "commission", "payment"];

export function createDraft(id: string, date: string): TripDraft {
  return {
    id,
    date,
    startMinute: null,
    endMinute: null,
    amount: "",
    commission: "",
    payment: "card",
  };
}

const MS_PER_MINUTE = 60_000;

/** Форма редактирования: время поездки — в минутах от полуночи её дня. */
export function draftFromTrip(trip: Trip, tzOffset: string): TripDraft {
  const date = dayKeyInZone(trip.start, tzOffset);
  const dayStartMs = dayStartMsOf(date, tzOffset);
  return {
    id: trip.id,
    date,
    startMinute: Math.round((Date.parse(trip.start) - dayStartMs) / MS_PER_MINUTE),
    endMinute: Math.round((Date.parse(trip.end) - dayStartMs) / MS_PER_MINUTE),
    amount: String(trip.amount),
    commission: String(trip.commission),
    payment: trip.payment,
  };
}

/** Есть ли что терять при закрытии формы. */
export function isDraftDirty(draft: TripDraft, initial: TripDraft): boolean {
  return (
    draft.startMinute !== initial.startMinute ||
    draft.endMinute !== initial.endMinute ||
    draft.amount.trim() !== initial.amount.trim() ||
    draft.commission.trim() !== initial.commission.trim() ||
    draft.payment !== initial.payment
  );
}

/** «На руки» с одной поездки — в тиынах, чтобы не было хвостов дробей. */
export function netOfTrip(trip: Pick<Trip, "amount" | "commission">): number {
  return (Math.round(trip.amount * 100) - Math.round(trip.commission * 100)) / 100;
}

export function tripChangesOf(trip: Trip): TripChanges {
  const { id: _id, ...changes } = trip;
  return changes;
}

/** `1 500,50` → 1500.5. Копейки и знак проверяет сервер — правила живут в одном месте. */
export function parseMoneyInput(text: string): number | null {
  const compact = text.replace(/[\s ]/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(compact)) return null;
  return Number(compact);
}

export function suggestCommission(amountText: string): string | null {
  const amount = parseMoneyInput(amountText);
  if (amount === null) return null;
  return String(Math.round(amount * DEFAULT_COMMISSION_RATE * 100) / 100);
}

/** Минута 1455 дня 2026-10-02 → `2026-10-03T00:15:00+05:00`. */
export function minuteToIso(date: string, minuteValue: number, tzOffset: string): string {
  const day = addDays(date, dayOffsetOf(minuteValue));
  return `${day}T${formatClockTime(minuteValue)}:00${tzOffset}`;
}

/**
 * Клиент проверяет только то, без чего не собрать запрос: время выбрано,
 * суммы читаются как числа. Смысловые правила — сумма больше нуля,
 * пересечения — проверяет сервер, и его ответ показывается у нужного поля.
 */
export function buildTripFromDraft(draft: TripDraft, tzOffset: string): DraftBuildResult {
  const amount = parseMoneyInput(draft.amount);
  const commission = parseMoneyInput(draft.commission);

  const errors: DraftErrors = {};
  if (draft.startMinute === null) errors.start = "Выберите время начала";
  if (draft.endMinute === null) errors.end = "Выберите время окончания";
  if (amount === null) errors.amount = "Введите сумму числом";
  if (commission === null) errors.commission = "Введите комиссию числом";

  if (draft.startMinute === null || draft.endMinute === null || amount === null || commission === null) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    trip: {
      id: draft.id,
      start: minuteToIso(draft.date, draft.startMinute, tzOffset),
      end: minuteToIso(draft.date, draft.endMinute, tzOffset),
      amount,
      payment: draft.payment,
      commission,
    },
  };
}

function isDraftField(field: string): field is DraftField {
  return (DRAFT_FIELDS as readonly string[]).includes(field);
}

export function mapServerFieldErrors(fields: Partial<Record<string, string>> | undefined): DraftErrors {
  const errors: DraftErrors = {};
  for (const [field, message] of Object.entries(fields ?? {})) {
    if (isDraftField(field) && message) errors[field] = message;
  }
  return errors;
}
