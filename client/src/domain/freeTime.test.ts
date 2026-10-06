import { describe, expect, it } from "vitest";
import {
  busyRangesOfDay,
  dayOffsetOf,
  describeRange,
  formatClockTime,
  latestEndMinute,
  overlappingRange,
  rangeContaining,
  toMinuteRanges,
} from "./freeTime";

const DAY_START_MS = Date.parse("2026-10-01T00:00:00+05:00");

/** 12:00 → 720 */
function at(hours: number, minutes = 0): number {
  return hours * 60 + minutes;
}

describe("занятое время в минутах дня", () => {
  it("поездка дня, ночная вчерашняя и утренняя завтрашняя", () => {
    const ranges = toMinuteRanges(
      [
        { start: "2026-10-01T12:00:00+05:00", end: "2026-10-01T12:25:00+05:00" },
        { start: "2026-09-30T23:30:00+05:00", end: "2026-10-01T00:20:00+05:00" },
        { start: "2026-10-02T07:00:00+05:00", end: "2026-10-02T07:30:00+05:00" },
      ],
      DAY_START_MS
    );
    expect(ranges).toEqual([
      { from: -30, to: 20 },
      { from: at(12), to: at(12, 25) },
      { from: 1440 + at(7), to: 1440 + at(7, 30) },
    ]);
  });

  it("время, записанное в UTC, переводится на часы бизнеса", () => {
    const ranges = toMinuteRanges([{ start: "2026-10-01T07:00:00Z", end: "2026-10-01T07:30:00Z" }], DAY_START_MS);
    expect(ranges).toEqual([{ from: at(12), to: at(12, 30) }]);
  });

  it("секунды не дают выбрать минуту, которую сервер отклонит", () => {
    const ranges = toMinuteRanges(
      [{ start: "2026-10-01T12:00:30+05:00", end: "2026-10-01T12:10:30+05:00" }],
      DAY_START_MS
    );
    expect(ranges).toEqual([{ from: at(12), to: at(12, 11) }]);
  });
});

describe("занятое время при редактировании", () => {
  const busy = [
    { tripId: "a", start: "2026-10-01T09:00:00+05:00", end: "2026-10-01T09:30:00+05:00" },
    { tripId: "b", start: "2026-10-01T12:00:00+05:00", end: "2026-10-01T12:25:00+05:00" },
  ];

  it("своё время поездке не мешает, чужое — мешает", () => {
    expect(busyRangesOfDay("2026-10-01", "+05:00", busy, "b")).toEqual([{ from: at(9), to: at(9, 30) }]);
    expect(busyRangesOfDay("2026-10-01", "+05:00", busy)).toHaveLength(2);
  });
});

describe("занято ли время", () => {
  const ranges = [
    { from: -30, to: 20 },
    { from: at(12), to: at(12, 25) },
  ];

  it("минута внутри поездки занята, минута её окончания свободна", () => {
    expect(rangeContaining(at(12), ranges)).toEqual({ from: at(12), to: at(12, 25) });
    expect(rangeContaining(at(12, 24), ranges)).toBeDefined();
    expect(rangeContaining(at(12, 25), ranges)).toBeUndefined();
    expect(rangeContaining(at(11, 59), ranges)).toBeUndefined();
  });

  it("ночная поездка со вчера занимает начало дня", () => {
    expect(rangeContaining(10, ranges)).toEqual({ from: -30, to: 20 });
    expect(rangeContaining(20, ranges)).toBeUndefined();
  });

  it("пересечение промежутков: внахлёст — да, встык — нет", () => {
    expect(overlappingRange(at(11, 30), at(12, 5), ranges)).toEqual({ from: at(12), to: at(12, 25) });
    expect(overlappingRange(at(11, 30), at(12), ranges)).toBeUndefined();
    expect(overlappingRange(at(12, 25), at(12, 40), ranges)).toBeUndefined();
    expect(overlappingRange(at(11), at(13), ranges)).toBeDefined();
  });
});

describe("до какого времени свободно", () => {
  const ranges = [{ from: at(12), to: at(12, 25) }];

  it("до начала следующей поездки", () => {
    expect(latestEndMinute(at(11, 30), ranges)).toBe(at(12));
  });

  it("после последней поездки — до конца следующего дня", () => {
    expect(latestEndMinute(at(23, 40), ranges)).toBe(2 * 1440 - 1);
  });

  it("утренняя поездка следующего дня ограничивает ночную", () => {
    const withTomorrow = [...ranges, { from: 1440 + at(7), to: 1440 + at(7, 30) }];
    expect(latestEndMinute(at(23, 40), withTomorrow)).toBe(1440 + at(7));
  });
});

describe("подписи", () => {
  it("время дня, следующего дня и ночной поездки вчерашнего дня", () => {
    expect(formatClockTime(at(8, 5))).toBe("08:05");
    expect(formatClockTime(1440 + 15)).toBe("00:15");
    expect(formatClockTime(-20)).toBe("23:40");
    expect(dayOffsetOf(at(23, 59))).toBe(0);
    expect(dayOffsetOf(1440 + 15)).toBe(1);
  });

  it("промежуток поездки", () => {
    expect(describeRange({ from: -30, to: 20 })).toBe("23:30–00:20");
    expect(describeRange({ from: at(12), to: at(12, 25) })).toBe("12:00–12:25");
  });
});
