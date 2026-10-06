import { tripDayKey, tripInterval, type DayKey } from "../domain/businessDay";
import { computeDaySummary, type DaySummary } from "../domain/daySummary";
import { toMinorUnits } from "../domain/money";
import { formatTzOffset } from "../domain/time";
import type { Trip } from "../domain/trip";
import { validateTrip, type TripFieldErrors } from "../domain/validateTrip";
import type { TripRepository } from "../storage/tripRepository";

export interface DayReport {
  date: DayKey;
  /** Пояс, в котором считаются дни: клиенту по нему показывать время поездок */
  tzOffset: string;
  summary: DaySummary;
  trips: Trip[];
}

export interface DayOverview {
  date: DayKey;
  tripsCount: number;
}

export type AddTripOutcome =
  | { kind: "created"; trip: Trip; date: DayKey }
  | { kind: "replayed"; trip: Trip; date: DayKey }
  | { kind: "invalid"; fieldErrors: TripFieldErrors }
  | { kind: "id_conflict"; existingTrip: Trip }
  | { kind: "overlap"; conflictingTrip: Trip };

/**
 * «Та же поездка» сравнивается по смыслу, а не по тексту: `08:10+05:00` и
 * `03:10Z` — один момент, `1500` и `1500.00` — одна сумма.
 */
function isSameTripData(left: Trip, right: Trip): boolean {
  const leftInterval = tripInterval(left);
  const rightInterval = tripInterval(right);
  return (
    leftInterval.startMs === rightInterval.startMs &&
    leftInterval.endMs === rightInterval.endMs &&
    toMinorUnits(left.amount) === toMinorUnits(right.amount) &&
    toMinorUnits(left.commission) === toMinorUnits(right.commission) &&
    left.payment === right.payment
  );
}

function pickTripFields(input: Trip): Trip {
  const { id, start, end, amount, payment, commission } = input;
  return { id, start, end, amount, payment, commission };
}

export class TripService {
  constructor(
    private readonly repository: TripRepository,
    private readonly tzOffsetMinutes: number
  ) {}

  listDays(): DayOverview[] {
    const countsByDay = new Map<DayKey, number>();
    for (const trip of this.repository.all()) {
      const day = tripDayKey(trip, this.tzOffsetMinutes);
      countsByDay.set(day, (countsByDay.get(day) ?? 0) + 1);
    }
    return [...countsByDay.entries()]
      .map(([date, tripsCount]) => ({ date, tripsCount }))
      .sort((left, right) => left.date.localeCompare(right.date));
  }

  getDay(date: DayKey): DayReport {
    const trips = this.repository
      .all()
      .filter((trip) => tripDayKey(trip, this.tzOffsetMinutes) === date)
      .sort((left, right) => tripInterval(left).startMs - tripInterval(right).startMs);

    return {
      date,
      tzOffset: formatTzOffset(this.tzOffsetMinutes),
      summary: computeDaySummary(trips),
      trips,
    };
  }

  /**
   * Все проверки и вставка в память выполняются до первого `await` — см.
   * комментарий к TripRepository: это и делает повторную отправку безопасной.
   */
  async addTrip(input: Trip): Promise<AddTripOutcome> {
    const trip = pickTripFields(input);

    const validation = validateTrip(trip);
    if (!validation.ok) return { kind: "invalid", fieldErrors: validation.fieldErrors };

    const date = tripDayKey(trip, this.tzOffsetMinutes);
    const existingTrip = this.repository.findById(trip.id);
    if (existingTrip) {
      return isSameTripData(existingTrip, trip)
        ? { kind: "replayed", trip: existingTrip, date }
        : { kind: "id_conflict", existingTrip };
    }

    const conflictingTrip = this.findOverlappingTrip(trip);
    if (conflictingTrip) return { kind: "overlap", conflictingTrip };

    await this.repository.insert(trip);
    return { kind: "created", trip, date };
  }

  /** Встык (одна закончилась ровно тогда, когда началась другая) — не пересечение. */
  private findOverlappingTrip(candidate: Trip): Trip | undefined {
    const candidateInterval = tripInterval(candidate);
    return this.repository.all().find((existing) => {
      const existingInterval = tripInterval(existing);
      return (
        existingInterval.startMs < candidateInterval.endMs &&
        candidateInterval.startMs < existingInterval.endMs
      );
    });
  }
}
