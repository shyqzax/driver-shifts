import { describe, expect, it } from "vitest";
import { dayKeyOf, isValidDayKey, tripDayKey } from "../src/domain/businessDay";
import { formatTzOffset, parseInstant, parseTzOffset } from "../src/domain/time";
import { BUSINESS_TZ_OFFSET_MINUTES, makeTrip } from "./fixtures";

describe("к какому дню относится поездка", () => {
  it("поздний вечер по местному времени — это ещё тот же день, хотя в UTC уже другой", () => {
    const trip = makeTrip({ start: "2026-10-01T23:50:00+05:00", end: "2026-10-01T23:58:00+05:00" });
    expect(tripDayKey(trip, BUSINESS_TZ_OFFSET_MINUTES)).toBe("2026-10-01");
  });

  it("раннее утро по местному времени — новый день, хотя в UTC ещё вчера", () => {
    const trip = makeTrip({ start: "2026-10-02T02:00:00+05:00", end: "2026-10-02T02:20:00+05:00" });
    expect(tripDayKey(trip, BUSINESS_TZ_OFFSET_MINUTES)).toBe("2026-10-02");
  });

  it("та же поездка, записанная в UTC, попадает в тот же день", () => {
    const local = makeTrip({ start: "2026-10-01T23:50:00+05:00", end: "2026-10-01T23:58:00+05:00" });
    const utc = makeTrip({ start: "2026-10-01T18:50:00Z", end: "2026-10-01T18:58:00Z" });
    expect(tripDayKey(utc, BUSINESS_TZ_OFFSET_MINUTES)).toBe(tripDayKey(local, BUSINESS_TZ_OFFSET_MINUTES));
  });

  it("поездка через полночь относится к дню начала", () => {
    const trip = makeTrip({ start: "2026-10-02T23:40:00+05:00", end: "2026-10-03T00:15:00+05:00" });
    expect(tripDayKey(trip, BUSINESS_TZ_OFFSET_MINUTES)).toBe("2026-10-02");
  });

  it("день считается по поясу бизнеса, а не по поясу из записи поездки", () => {
    // 22:30 по Москве = 00:30 следующего дня по +05:00
    const trip = makeTrip({ start: "2026-10-01T22:30:00+03:00", end: "2026-10-01T22:50:00+03:00" });
    expect(tripDayKey(trip, BUSINESS_TZ_OFFSET_MINUTES)).toBe("2026-10-02");
  });

  it("dayKeyOf работает и с отрицательным поясом", () => {
    expect(dayKeyOf(Date.UTC(2026, 9, 1, 2, 0), -3 * 60)).toBe("2026-09-30");
  });
});

describe("разбор дат", () => {
  it("принимает ISO 8601 с поясом, в том числе без секунд и с долями секунды", () => {
    expect(parseInstant("2026-10-01T08:10:00+05:00")).toBe(Date.UTC(2026, 9, 1, 3, 10));
    expect(parseInstant("2026-10-01T08:10+05:00")).toBe(Date.UTC(2026, 9, 1, 3, 10));
    expect(parseInstant("2026-10-01T03:10:00.5Z")).toBe(Date.UTC(2026, 9, 1, 3, 10, 0, 500));
  });

  it.each([
    ["без пояса — непонятно, чьё это время", "2026-10-01T08:10:00"],
    ["несуществующая дата", "2026-02-30T10:00:00+05:00"],
    ["24 часа", "2026-10-01T24:00:00+05:00"],
    ["61 минута", "2026-10-01T10:61:00+05:00"],
    ["только дата", "2026-10-01"],
    ["пояс за пределами ±14:00", "2026-10-01T10:00:00+15:00"],
    ["мусор", "вчера утром"],
  ])("отклоняет: %s", (_reason, text) => {
    expect(parseInstant(text)).toBeNull();
  });

  it("29 февраля есть только в високосный год", () => {
    expect(parseInstant("2028-02-29T10:00:00+05:00")).not.toBeNull();
    expect(parseInstant("2026-02-29T10:00:00+05:00")).toBeNull();
  });

  it("пояс читается и печатается обратно", () => {
    expect(parseTzOffset("+05:00")).toBe(300);
    expect(parseTzOffset("-03:30")).toBe(-210);
    expect(parseTzOffset("Z")).toBe(0);
    expect(parseTzOffset("5")).toBeNull();
    expect(formatTzOffset(300)).toBe("+05:00");
    expect(formatTzOffset(-210)).toBe("-03:30");
  });

  it("проверка дня в адресе запроса", () => {
    expect(isValidDayKey("2026-10-01")).toBe(true);
    expect(isValidDayKey("2026-13-40")).toBe(false);
    expect(isValidDayKey("2026-02-30")).toBe(false);
    expect(isValidDayKey("01.10.2026")).toBe(false);
  });
});
