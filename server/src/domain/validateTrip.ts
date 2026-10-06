import { hasAtMostTwoDecimals, toMinorUnits } from "./money";
import { parseInstant } from "./time";
import { isPaymentMethod, type Trip } from "./trip";

export type TripField = keyof Trip;
export type TripFieldErrors = Partial<Record<TripField, string>>;

export type TripValidationResult = { ok: true } | { ok: false; fieldErrors: TripFieldErrors };

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/** Предел против опечаток вида «лишние три нуля»; заодно держит суммы в точной зоне чисел. */
const MAX_AMOUNT = 10_000_000;

const DATE_FORMAT_HINT =
  "Нужна дата со временем и часовым поясом, например 2026-10-01T08:10:00+05:00";

function validateMoney(value: number, label: string): string | null {
  if (!Number.isFinite(value)) return `${label}: нужно число`;
  if (!hasAtMostTwoDecimals(value)) return `${label}: не больше двух знаков после запятой`;
  if (value > MAX_AMOUNT) return `${label}: слишком большая сумма`;
  return null;
}

function validateAmount(amount: number): string | null {
  const moneyError = validateMoney(amount, "Сумма");
  if (moneyError) return moneyError;
  if (amount <= 0) return "Сумма должна быть больше нуля";
  return null;
}

function validateCommission(commission: number, amount: number): string | null {
  const moneyError = validateMoney(commission, "Комиссия");
  if (moneyError) return moneyError;
  if (commission < 0) return "Комиссия не может быть отрицательной";
  if (validateAmount(amount) === null && toMinorUnits(commission) > toMinorUnits(amount)) {
    return "Комиссия не может быть больше суммы поездки";
  }
  return null;
}

function validateInterval(trip: Trip): TripFieldErrors {
  const startMs = parseInstant(trip.start);
  const endMs = parseInstant(trip.end);
  const errors: TripFieldErrors = {};
  if (startMs === null) errors.start = DATE_FORMAT_HINT;
  if (endMs === null) errors.end = DATE_FORMAT_HINT;
  if (startMs !== null && endMs !== null && endMs <= startMs) {
    errors.end = "Окончание должно быть позже начала";
  }
  return errors;
}

/** Проверка смысла поездки. Форму запроса (типы, обязательные поля) проверяет схема маршрута. */
export function validateTrip(trip: Trip): TripValidationResult {
  const fieldErrors: TripFieldErrors = { ...validateInterval(trip) };

  if (!ID_PATTERN.test(trip.id)) {
    fieldErrors.id = "Идентификатор: от 1 до 64 символов — латиница, цифры, «-» и «_»";
  }
  if (!isPaymentMethod(trip.payment)) {
    fieldErrors.payment = "Способ оплаты: cash (наличные) или card (карта)";
  }

  const amountError = validateAmount(trip.amount);
  if (amountError) fieldErrors.amount = amountError;

  const commissionError = validateCommission(trip.commission, trip.amount);
  if (commissionError) fieldErrors.commission = commissionError;

  return Object.keys(fieldErrors).length === 0 ? { ok: true } : { ok: false, fieldErrors };
}
