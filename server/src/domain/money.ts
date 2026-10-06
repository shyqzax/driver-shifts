/**
 * Деньги приходят с копейками (тиынами), а дробные числа JavaScript складываются
 * с хвостами: 0.1 + 0.2 = 0.30000000000000004. Поэтому всё считается в целых
 * минимальных единицах и переводится обратно только на выходе.
 */
const MINOR_UNITS_PER_MAJOR = 100;

/** Погрешность умножения на 100: 0.29 * 100 = 28.999999999999996 — это всё ещё 29 тиынов. */
const FLOAT_TOLERANCE = 1e-6;

export function hasAtMostTwoDecimals(amount: number): boolean {
  const scaled = amount * MINOR_UNITS_PER_MAJOR;
  return Math.abs(scaled - Math.round(scaled)) < FLOAT_TOLERANCE;
}

export function toMinorUnits(amount: number): number {
  return Math.round(amount * MINOR_UNITS_PER_MAJOR);
}

export function fromMinorUnits(minorUnits: number): number {
  return minorUnits / MINOR_UNITS_PER_MAJOR;
}
