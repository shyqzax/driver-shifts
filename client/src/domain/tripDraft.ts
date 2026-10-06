import type { PaymentMethod, Trip, TripChanges } from "../types/api";
import { addDays, dayKeyInZone } from "../utils/format";
import {
  dayOffsetOf,
  dayStartMsOf,
  describeRange,
  formatClockTime,
  LAST_END_MINUTE,
  latestEndMinute,
  MINUTES_PER_DAY,
  overlappingRange,
  rangeContaining,
  type MinuteRange,
} from "./freeTime";
import { isTimeTextComplete, parseTimeText } from "./timeInput";

/** Форма поездки: всё, что вводит водитель, хранится как текст до отправки. */
export interface TripDraft {
  /** Номер поездки придумывается один раз при открытии формы — повторная отправка шлёт его же */
  id: string;
  date: string;
  /** «ЧЧ:ММ» по мере ввода: «1», «12:», «12:3», «12:30» */
  startTime: string;
  endTime: string;
  endsNextDay: boolean;
  amount: string;
  commission: string;
  payment: PaymentMethod;
}

export type DraftField = "start" | "end" | "amount" | "commission" | "payment";
export type DraftErrors = Partial<Record<DraftField, string>>;

export type DraftBuildResult = { ok: true; trip: Trip } | { ok: false; errors: DraftErrors };

export type DraftTimes = Pick<TripDraft, "startTime" | "endTime" | "endsNextDay">;

export interface TimeCheck {
  errors: Pick<DraftErrors, "start" | "end">;
  /** «Свободно до 13:20» — сколько можно ехать до следующей поездки */
  endHint?: string;
}

const DEFAULT_COMMISSION_RATE = 0.15;
const MS_PER_MINUTE = 60_000;
const TIME_FORMAT_HINT = "Введите время: ЧЧ:ММ";
const NO_SUCH_TIME = "Нет такого времени";

const DRAFT_FIELDS: readonly DraftField[] = ["start", "end", "amount", "commission", "payment"];

export function createDraft(id: string, date: string): TripDraft {
  return {
    id,
    date,
    startTime: "",
    endTime: "",
    endsNextDay: false,
    amount: "",
    commission: "",
    payment: "card",
  };
}

/** Форма редактирования: время поездки — по часам её дня. */
export function draftFromTrip(trip: Trip, tzOffset: string): TripDraft {
  const date = dayKeyInZone(trip.start, tzOffset);
  const dayStartMs = dayStartMsOf(date, tzOffset);
  const startMinute = Math.round((Date.parse(trip.start) - dayStartMs) / MS_PER_MINUTE);
  const endMinute = Math.round((Date.parse(trip.end) - dayStartMs) / MS_PER_MINUTE);
  return {
    id: trip.id,
    date,
    startTime: formatClockTime(startMinute),
    endTime: formatClockTime(endMinute),
    endsNextDay: endMinute >= MINUTES_PER_DAY,
    amount: String(trip.amount),
    commission: String(trip.commission),
    payment: trip.payment,
  };
}

/** Есть ли что терять при закрытии формы. */
export function isDraftDirty(draft: TripDraft, initial: TripDraft): boolean {
  return (
    draft.startTime !== initial.startTime ||
    draft.endTime !== initial.endTime ||
    draft.endsNextDay !== initial.endsNextDay ||
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

function endMinuteOf(times: DraftTimes): number | null {
  const endOfDay = parseTimeText(times.endTime);
  if (endOfDay === null) return null;
  return times.endsNextDay ? endOfDay + MINUTES_PER_DAY : endOfDay;
}

function describeEndLimit(latestEnd: number): string | undefined {
  if (latestEnd >= LAST_END_MINUTE) return undefined;
  const nextDay = dayOffsetOf(latestEnd) > 0 ? " следующего дня" : "";
  return `Свободно до ${formatClockTime(latestEnd)}${nextDay} — дальше следующая поездка`;
}

function checkStart(startTime: string, ranges: readonly MinuteRange[]): string | undefined {
  if (!isTimeTextComplete(startTime)) return undefined;
  const start = parseTimeText(startTime);
  if (start === null) return NO_SUCH_TIME;
  const busy = rangeContaining(start, ranges);
  return busy ? `Занято поездкой ${describeRange(busy)}` : undefined;
}

function checkEnd(times: DraftTimes, ranges: readonly MinuteRange[]): string | undefined {
  if (!isTimeTextComplete(times.endTime)) return undefined;
  const end = endMinuteOf(times);
  if (end === null) return NO_SUCH_TIME;
  const start = parseTimeText(times.startTime);
  if (start === null) return undefined;
  if (end <= start) {
    return "Окончание раньше начала. Если поездка закончилась после полуночи — отметьте это ниже";
  }
  const overlap = overlappingRange(start, end, ranges);
  return overlap ? `Пересекается с поездкой ${describeRange(overlap)}` : undefined;
}

/**
 * Подсказки по времени прямо при вводе: занято ли начало, не налезает ли
 * поездка на соседнюю, до какого времени свободно. Сервер проверяет то же
 * самое и остаётся источником правды — здесь только чтобы не ждать ответа.
 */
export function checkDraftTimes(times: DraftTimes, ranges: readonly MinuteRange[]): TimeCheck {
  const errors: TimeCheck["errors"] = {};
  const startError = checkStart(times.startTime, ranges);
  if (startError) errors.start = startError;
  const endError = checkEnd(times, ranges);
  if (endError) errors.end = endError;

  const start = parseTimeText(times.startTime);
  const endHint = start !== null && !startError ? describeEndLimit(latestEndMinute(start, ranges)) : undefined;
  return { errors, endHint };
}

/**
 * Сборка запроса: время должно быть введено полностью, суммы — читаться как
 * числа. Смысловые правила (сумма больше нуля, пересечения) проверяет сервер.
 */
export function buildTripFromDraft(draft: TripDraft, tzOffset: string): DraftBuildResult {
  const start = parseTimeText(draft.startTime);
  const end = endMinuteOf(draft);
  const amount = parseMoneyInput(draft.amount);
  const commission = parseMoneyInput(draft.commission);

  const errors: DraftErrors = {};
  if (start === null) errors.start = isTimeTextComplete(draft.startTime) ? NO_SUCH_TIME : TIME_FORMAT_HINT;
  if (end === null) errors.end = isTimeTextComplete(draft.endTime) ? NO_SUCH_TIME : TIME_FORMAT_HINT;
  if (amount === null) errors.amount = "Введите сумму числом";
  if (commission === null) errors.commission = "Введите комиссию числом";

  if (start === null || end === null || amount === null || commission === null) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    trip: {
      id: draft.id,
      start: minuteToIso(draft.date, start, tzOffset),
      end: minuteToIso(draft.date, end, tzOffset),
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
