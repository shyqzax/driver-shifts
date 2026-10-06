import { describe, expect, it } from "vitest";
import type { Trip } from "../src/domain/trip";
import { validateTrip } from "../src/domain/validateTrip";
import { makeTrip, TASK_EXAMPLE_TRIPS } from "./fixtures";

function fieldErrorsOf(trip: Trip) {
  const result = validateTrip(trip);
  return result.ok ? {} : result.fieldErrors;
}

describe("проверка поездки", () => {
  it("поездки из задания проходят проверку", () => {
    for (const trip of TASK_EXAMPLE_TRIPS) {
      expect(validateTrip(trip)).toEqual({ ok: true });
    }
  });

  it("сумма с копейками допустима", () => {
    expect(validateTrip(makeTrip({ amount: 1999.99, commission: 299.99 }))).toEqual({ ok: true });
  });

  it.each([
    ["ноль", 0],
    ["отрицательная", -500],
  ])("сумма должна быть больше нуля: %s", (_label, amount) => {
    expect(fieldErrorsOf(makeTrip({ amount, commission: 0 })).amount).toBe(
      "Сумма должна быть больше нуля"
    );
  });

  it("сумма: не больше двух знаков после запятой", () => {
    expect(fieldErrorsOf(makeTrip({ amount: 100.005, commission: 0 })).amount).toMatch(
      /двух знаков/
    );
  });

  it("сумма: NaN и бесконечность — не числа", () => {
    expect(fieldErrorsOf(makeTrip({ amount: Number.NaN })).amount).toMatch(/нужно число/);
    expect(fieldErrorsOf(makeTrip({ amount: Number.POSITIVE_INFINITY })).amount).toMatch(
      /нужно число/
    );
  });

  it("окончание в ту же минуту, что и начало, — ошибка", () => {
    const trip = makeTrip({ start: "2026-10-01T10:00:00+05:00", end: "2026-10-01T10:00:00+05:00" });
    expect(fieldErrorsOf(trip)).toEqual({ end: "Окончание должно быть позже начала" });
  });

  it("окончание раньше начала — ошибка", () => {
    const trip = makeTrip({ start: "2026-10-01T10:00:00+05:00", end: "2026-10-01T09:30:00+05:00" });
    expect(fieldErrorsOf(trip)).toEqual({ end: "Окончание должно быть позже начала" });
  });

  it("сравнение начала и окончания учитывает пояса", () => {
    // 10:00 по +05:00 = 05:00 UTC, значит 05:30Z — на полчаса позже начала
    const trip = makeTrip({ start: "2026-10-01T10:00:00+05:00", end: "2026-10-01T05:30:00Z" });
    expect(validateTrip(trip)).toEqual({ ok: true });
  });

  it("дата без пояса отклоняется", () => {
    expect(fieldErrorsOf(makeTrip({ start: "2026-10-01T10:00:00" })).start).toMatch(/часовым поясом/);
  });

  it("комиссия не больше суммы и не отрицательная", () => {
    expect(fieldErrorsOf(makeTrip({ amount: 1000, commission: 1000.01 })).commission).toBe(
      "Комиссия не может быть больше суммы поездки"
    );
    expect(fieldErrorsOf(makeTrip({ commission: -1 })).commission).toBe(
      "Комиссия не может быть отрицательной"
    );
    expect(validateTrip(makeTrip({ amount: 1000, commission: 1000 }))).toEqual({ ok: true });
    expect(validateTrip(makeTrip({ commission: 0 }))).toEqual({ ok: true });
  });

  it("неизвестный способ оплаты и пустой идентификатор", () => {
    const errors = fieldErrorsOf({ ...makeTrip(), id: "", payment: "crypto" as Trip["payment"] });
    expect(Object.keys(errors).sort()).toEqual(["id", "payment"]);
  });

  it("собирает ошибки по всем полям сразу, чтобы форма подсветила их вместе", () => {
    const trip = makeTrip({
      amount: 0,
      start: "2026-10-01T10:00:00+05:00",
      end: "2026-10-01T09:00:00+05:00",
    });
    expect(Object.keys(fieldErrorsOf(trip)).sort()).toEqual(["amount", "end"]);
  });
});
