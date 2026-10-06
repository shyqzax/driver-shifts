import { describe, expect, it } from "vitest";
import { computeDaySummary } from "../src/domain/daySummary";
import { makeTrip, TASK_EXAMPLE_TRIPS } from "./fixtures";

describe("сводка за день", () => {
  it("пустой день — все показатели нулевые", () => {
    expect(computeDaySummary([])).toEqual({
      tripsCount: 0,
      revenue: 0,
      commission: 0,
      net: 0,
      byPayment: { cash: { count: 0, amount: 0 }, card: { count: 0, amount: 0 } },
    });
  });

  it("пример из задания: выручка, комиссия, на руки и разбивка по оплате", () => {
    expect(computeDaySummary(TASK_EXAMPLE_TRIPS)).toEqual({
      tripsCount: 2,
      revenue: 3900,
      commission: 585,
      net: 3315,
      byPayment: { cash: { count: 1, amount: 1500 }, card: { count: 1, amount: 2400 } },
    });
  });

  it("«на руки» = выручка − комиссия, независимо от способа оплаты", () => {
    const summary = computeDaySummary([
      makeTrip({ id: "a", amount: 1000, commission: 150, payment: "cash" }),
      makeTrip({ id: "b", amount: 3000, commission: 0, payment: "card" }),
    ]);
    expect(summary.net).toBe(3850);
    expect(summary.net).toBe(summary.revenue - summary.commission);
  });

  it("день только с наличными — у карты нули", () => {
    const summary = computeDaySummary([
      makeTrip({ id: "a", payment: "cash", amount: 700, commission: 105 }),
      makeTrip({ id: "b", payment: "cash", amount: 900, commission: 135 }),
    ]);
    expect(summary.byPayment).toEqual({
      cash: { count: 2, amount: 1600 },
      card: { count: 0, amount: 0 },
    });
  });

  it("суммы с копейками складываются без хвостов дробей", () => {
    // В обычной арифметике 0.1 + 0.2 = 0.30000000000000004
    const summary = computeDaySummary([
      makeTrip({ id: "a", amount: 0.1, commission: 0.01 }),
      makeTrip({ id: "b", amount: 0.2, commission: 0.02 }),
      makeTrip({ id: "c", amount: 1999.99, commission: 299.99, payment: "cash" }),
    ]);
    expect(summary.revenue).toBe(2000.29);
    expect(summary.commission).toBe(300.02);
    expect(summary.net).toBe(1700.27);
    expect(summary.byPayment.card.amount).toBe(0.3);
  });
});
