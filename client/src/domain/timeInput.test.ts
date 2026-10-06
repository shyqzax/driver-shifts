import { describe, expect, it } from "vitest";
import { isTimeTextComplete, maskTimeInput, parseTimeText } from "./timeInput";

/** Набор по одному символу, как на клавиатуре телефона. */
function typeKeys(keys: string, start = ""): string {
  let value = start;
  for (const key of keys) {
    value = maskTimeInput(value + key, value);
  }
  return value;
}

function erase(value: string, times: number): string {
  let current = value;
  for (let index = 0; index < times; index += 1) {
    current = maskTimeInput(current.slice(0, -1), current);
  }
  return current;
}

describe("ввод времени с автоматическим двоеточием", () => {
  it("после двух цифр часа двоеточие ставится само", () => {
    expect(typeKeys("1")).toBe("1");
    expect(typeKeys("12")).toBe("12:");
    expect(typeKeys("123")).toBe("12:3");
    expect(typeKeys("1230")).toBe("12:30");
  });

  it("лишние цифры отбрасываются", () => {
    expect(typeKeys("123045")).toBe("12:30");
  });

  it("первая цифра 3–9 — час из одной цифры", () => {
    expect(typeKeys("9")).toBe("09:");
    expect(typeKeys("930")).toBe("09:30");
    expect(typeKeys("0")).toBe("0");
    expect(typeKeys("2")).toBe("2");
  });

  it("стирание проходит через двоеточие, а не застревает на нём", () => {
    expect(erase("12:30", 1)).toBe("12:3");
    expect(erase("12:", 1)).toBe("12");
    expect(erase("12:", 2)).toBe("1");
    expect(erase("09:", 2)).toBe("0");
  });

  it("вставка готового времени и цифр подряд", () => {
    expect(maskTimeInput("12:30", "")).toBe("12:30");
    expect(maskTimeInput("0815", "")).toBe("08:15");
  });

  it("буквы и прочие символы игнорируются", () => {
    expect(typeKeys("1a2")).toBe("12:");
  });
});

describe("разбор времени", () => {
  it("полное время — минуты от полуночи", () => {
    expect(parseTimeText("00:00")).toBe(0);
    expect(parseTimeText("12:30")).toBe(750);
    expect(parseTimeText("23:59")).toBe(1439);
  });

  it("неполное и несуществующее — null", () => {
    expect(parseTimeText("12:")).toBeNull();
    expect(parseTimeText("12:3")).toBeNull();
    expect(parseTimeText("24:00")).toBeNull();
    expect(parseTimeText("12:60")).toBeNull();
    expect(isTimeTextComplete("12:3")).toBe(false);
    expect(isTimeTextComplete("25:00")).toBe(true);
  });
});
