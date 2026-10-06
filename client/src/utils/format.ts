const CURRENCY_SIGN = "₸";
const NO_BREAK_SPACE = " ";

const MONTHS_GENITIVE = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
] as const;

const WEEKDAYS_SHORT = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"] as const;

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 24 * 60 * MS_PER_MINUTE;

/**
 * Свой формат вместо Intl: движок Hermes на разных Android по-разному знает
 * русскую локаль, а сумма на экране водителя должна выглядеть одинаково везде.
 */
export function formatMoney(amount: number): string {
  const fixed = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  const [integerPart = "0", fractionPart] = fixed.split(".");
  const grouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, NO_BREAK_SPACE);
  const withFraction = fractionPart ? `${grouped},${fractionPart}` : grouped;
  return `${withFraction}${NO_BREAK_SPACE}${CURRENCY_SIGN}`;
}

export function pluralizeTrips(count: number): string {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return `${count} поездок`;
  if (last === 1) return `${count} поездка`;
  if (last >= 2 && last <= 4) return `${count} поездки`;
  return `${count} поездок`;
}

/** `+05:00` → 300 */
export function parseTzOffsetMinutes(tzOffset: string): number {
  const match = /^([+-])(\d{2}):(\d{2})$/.exec(tzOffset);
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === "-" ? -minutes : minutes;
}

function shiftToBusinessClock(isoInstant: string, tzOffset: string): Date {
  return new Date(Date.parse(isoInstant) + parseTzOffsetMinutes(tzOffset) * MS_PER_MINUTE);
}

/**
 * Время по часам бизнеса, а не телефона: у водителя в другом поясе иначе
 * «08:10» превратилось бы в «06:10», а поездка — оказалась бы не в своём дне.
 */
export function formatTimeInZone(isoInstant: string, tzOffset: string): string {
  return shiftToBusinessClock(isoInstant, tzOffset).toISOString().slice(11, 16);
}

export function dayKeyInZone(isoInstant: string, tzOffset: string): string {
  return shiftToBusinessClock(isoInstant, tzOffset).toISOString().slice(0, 10);
}

export function formatDuration(startIso: string, endIso: string): string {
  const totalMinutes = Math.round((Date.parse(endIso) - Date.parse(startIso)) / MS_PER_MINUTE);
  if (totalMinutes < 60) return `${totalMinutes} мин`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = String(totalMinutes % 60).padStart(2, "0");
  return `${hours} ч ${minutes} мин`;
}

function dayKeyToUtcDate(dayKey: string): Date {
  return new Date(`${dayKey}T00:00:00Z`);
}

export function addDays(dayKey: string, days: number): string {
  return new Date(dayKeyToUtcDate(dayKey).getTime() + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** `2026-10-01` → `ср, 1 октября` */
export function formatDayTitle(dayKey: string): string {
  const date = dayKeyToUtcDate(dayKey);
  const weekday = WEEKDAYS_SHORT[date.getUTCDay()];
  const month = MONTHS_GENITIVE[date.getUTCMonth()];
  return `${weekday}, ${date.getUTCDate()} ${month}`;
}

/** `2026-10-01` → `1 окт` */
export function formatDayChip(dayKey: string): string {
  const date = dayKeyToUtcDate(dayKey);
  const month = MONTHS_GENITIVE[date.getUTCMonth()]?.slice(0, 3) ?? "";
  return `${date.getUTCDate()} ${month}`;
}

export function todayInZone(tzOffset: string): string {
  return dayKeyInZone(new Date().toISOString(), tzOffset);
}
