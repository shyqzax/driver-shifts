const MS_PER_MINUTE = 60_000;
const MAX_OFFSET_MINUTES = 14 * 60;

/**
 * Свой разбор вместо `Date.parse`: тот молча превращает 30 февраля в 2 марта,
 * принимает 24:00, а время без пояса читает по часам компьютера, на котором
 * запущен сервер. Для поездки это значит «не тот день», поэтому пояс обязателен,
 * а несуществующие даты отклоняются.
 */
const ISO_INSTANT_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})$/;

const TZ_OFFSET_PATTERN = /^([+-])(\d{2}):(\d{2})$/;

/** `+05:00` → 300, `-03:30` → -210, `Z` → 0. */
export function parseTzOffset(text: string): number | null {
  if (text === "Z") return 0;

  const match = TZ_OFFSET_PATTERN.exec(text);
  if (!match) return null;

  const [, sign, hoursText, minutesText] = match;
  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  if (minutes > 59) return null;

  const totalMinutes = hours * 60 + minutes;
  if (totalMinutes > MAX_OFFSET_MINUTES) return null;
  return sign === "-" ? -totalMinutes : totalMinutes;
}

/** 300 → `+05:00` */
export function formatTzOffset(offsetMinutes: number): string {
  const sign = offsetMinutes < 0 ? "-" : "+";
  const absolute = Math.abs(offsetMinutes);
  const hours = String(Math.floor(absolute / 60)).padStart(2, "0");
  const minutes = String(absolute % 60).padStart(2, "0");
  return `${sign}${hours}:${minutes}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Момент времени в миллисекундах или `null`, если строка не ISO 8601 с поясом. */
export function parseInstant(text: string): number | null {
  const match = ISO_INSTANT_PATTERN.exec(text);
  if (!match) return null;

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, fractionText, offsetText] =
    match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText ?? "0");
  const millisecond = Number((fractionText ?? "0").padEnd(3, "0"));

  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  if (hour > 23 || minute > 59 || second > 59) return null;

  const offsetMinutes = parseTzOffset(offsetText ?? "");
  if (offsetMinutes === null) return null;

  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  return wallClockAsUtc - offsetMinutes * MS_PER_MINUTE;
}

export function minutesToMs(minutes: number): number {
  return minutes * MS_PER_MINUTE;
}
