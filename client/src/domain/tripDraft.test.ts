import { describe, expect, it } from "vitest";
import {
  buildTripFromDraft,
  createDraft,
  draftFromTrip,
  isDraftDirty,
  mapServerFieldErrors,
  netOfTrip,
  minuteToIso,
  parseMoneyInput,
  suggestCommission,
} from "./tripDraft";

const TZ = "+05:00";

describe("сборка поездки из формы", () => {
  it("время дня и время после полуночи превращаются в даты с поясом", () => {
    expect(minuteToIso("2026-10-02", 23 * 60 + 40, TZ)).toBe("2026-10-02T23:40:00+05:00");
    expect(minuteToIso("2026-10-02", 1440 + 15, TZ)).toBe("2026-10-03T00:15:00+05:00");
    expect(minuteToIso("2026-10-31", 1440 + 5, TZ)).toBe("2026-11-01T00:05:00+05:00");
  });

  it("заполненная форма даёт поездку для сервера с тем же номером", () => {
    const draft = {
      ...createDraft("trip-id", "2026-10-04"),
      startMinute: 12 * 60,
      endMinute: 12 * 60 + 25,
      amount: "1 800",
      commission: "270",
      payment: "cash" as const,
    };
    expect(buildTripFromDraft(draft, TZ)).toEqual({
      ok: true,
      trip: {
        id: "trip-id",
        start: "2026-10-04T12:00:00+05:00",
        end: "2026-10-04T12:25:00+05:00",
        amount: 1800,
        payment: "cash",
        commission: 270,
      },
    });
  });

  it("невыбранное время и нечисловые суммы — ошибки у полей", () => {
    const result = buildTripFromDraft({ ...createDraft("id", "2026-10-04"), amount: "много" }, TZ);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual(["amount", "commission", "end", "start"]);
    }
  });
});

describe("редактирование", () => {
  const nightTrip = {
    id: "t15",
    start: "2026-10-02T23:40:00+05:00",
    end: "2026-10-03T00:15:00+05:00",
    amount: 2800,
    payment: "cash" as const,
    commission: 420,
  };

  it("форма из ночной поездки: день начала, окончание после полуночи", () => {
    expect(draftFromTrip(nightTrip, TZ)).toEqual({
      id: "t15",
      date: "2026-10-02",
      startMinute: 23 * 60 + 40,
      endMinute: 1440 + 15,
      amount: "2800",
      commission: "420",
      payment: "cash",
    });
  });

  it("форма из поездки и обратно даёт ту же поездку", () => {
    const result = buildTripFromDraft(draftFromTrip(nightTrip, TZ), TZ);
    expect(result).toEqual({ ok: true, trip: nightTrip });
  });

  it("время, записанное в UTC, раскладывается по часам бизнеса", () => {
    const draft = draftFromTrip({ ...nightTrip, start: "2026-10-02T18:40:00Z", end: "2026-10-02T19:15:00Z" }, TZ);
    expect([draft.date, draft.startMinute, draft.endMinute]).toEqual(["2026-10-02", 23 * 60 + 40, 1440 + 15]);
  });

  it("несохранённые изменения: пробелы по краям — не изменение", () => {
    const initial = draftFromTrip(nightTrip, TZ);
    expect(isDraftDirty({ ...initial, amount: " 2800 " }, initial)).toBe(false);
    expect(isDraftDirty({ ...initial, amount: "2900" }, initial)).toBe(true);
    expect(isDraftDirty({ ...initial, endMinute: 1440 + 20 }, initial)).toBe(true);
    expect(isDraftDirty({ ...initial, payment: "card" }, initial)).toBe(true);
  });

  it("пустая новая форма — закрыть можно без вопросов", () => {
    const empty = createDraft("id", "2026-10-04");
    expect(isDraftDirty(empty, empty)).toBe(false);
    expect(isDraftDirty({ ...empty, startMinute: 600 }, empty)).toBe(true);
  });
});

describe("ввод денег", () => {
  it("пробелы и запятая допустимы", () => {
    expect(parseMoneyInput("1 500,50")).toBe(1500.5);
    expect(parseMoneyInput("2400")).toBe(2400);
    expect(parseMoneyInput("-5")).toBeNull();
    expect(parseMoneyInput("")).toBeNull();
  });

  it("«на руки» с поездки без хвостов дробей", () => {
    expect(netOfTrip({ amount: 2400, commission: 360 })).toBe(2040);
    expect(netOfTrip({ amount: 0.3, commission: 0.1 })).toBe(0.2);
  });

  it("подсказка комиссии — 15% с копейками", () => {
    expect(suggestCommission("2400")).toBe("360");
    expect(suggestCommission("1999")).toBe("299.85");
    expect(suggestCommission("abc")).toBeNull();
  });
});

describe("ошибки сервера", () => {
  it("попадают к полям формы, незнакомые поля отбрасываются", () => {
    expect(
      mapServerFieldErrors({ amount: "Сумма должна быть больше нуля", id: "плохой номер" })
    ).toEqual({ amount: "Сумма должна быть больше нуля" });
  });
});
