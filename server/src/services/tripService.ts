import { dayStartMs, tripDayKey, tripInterval, type DayKey } from "../domain/businessDay";
import { computeDaySummary, type DaySummary } from "../domain/daySummary";
import { toMinorUnits } from "../domain/money";
import { formatTzOffset } from "../domain/time";
import type { Trip } from "../domain/trip";
import { validateTrip, type TripFieldErrors } from "../domain/validateTrip";
import type { TripRepository } from "../storage/tripRepository";

/** Время, занятое уже записанной поездкой: новую сюда поставить нельзя. */
export interface BusyInterval {
  tripId: string;
  start: string;
  end: string;
}

export interface DayReport {
  date: DayKey;
  /** Пояс, в котором считаются дни: клиенту по нему показывать время поездок */
  tzOffset: string;
  summary: DaySummary;
  trips: Trip[];
  /**
   * Занятое время в этот и следующий день — для выбора времени в форме.
   * Сюда попадает и ночная поездка вчерашнего дня, которая заходит за
   * полночь, и поездки завтрашнего утра: до них может длиться поездка,
   * начатая сегодня поздно вечером.
   */
  busy: BusyInterval[];
}

const BUSY_WINDOW_DAYS = 2;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

export type TripChanges = Omit<Trip, "id">;

export type UpdateTripOutcome =
  | { kind: "updated"; trip: Trip; date: DayKey }
  | { kind: "not_found" }
  | { kind: "invalid"; fieldErrors: TripFieldErrors }
  | { kind: "overlap"; conflictingTrip: Trip };

export type DeleteTripOutcome = { kind: "deleted" } | { kind: "not_found" };

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
      busy: this.listBusyIntervals(date),
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

  /**
   * Изменение повторять безопасно: те же данные дают тот же результат. Своё
   * же старое время поездке не мешает — пересечение ищется среди остальных.
   */
  async updateTrip(id: string, changes: TripChanges): Promise<UpdateTripOutcome> {
    const trip = pickTripFields({ ...changes, id });

    const validation = validateTrip(trip);
    if (!validation.ok) return { kind: "invalid", fieldErrors: validation.fieldErrors };
    if (!this.repository.findById(id)) return { kind: "not_found" };

    const conflictingTrip = this.findOverlappingTrip(trip);
    if (conflictingTrip) return { kind: "overlap", conflictingTrip };

    await this.repository.replace(trip);
    return { kind: "updated", trip, date: tripDayKey(trip, this.tzOffsetMinutes) };
  }

  async deleteTrip(id: string): Promise<DeleteTripOutcome> {
    if (!this.repository.findById(id)) return { kind: "not_found" };
    await this.repository.remove(id);
    return { kind: "deleted" };
  }

  private listBusyIntervals(date: DayKey): BusyInterval[] {
    const windowStartMs = dayStartMs(date, this.tzOffsetMinutes);
    const windowEndMs = windowStartMs + BUSY_WINDOW_DAYS * MS_PER_DAY;
    return this.repository
      .all()
      .map((trip) => ({ trip, interval: tripInterval(trip) }))
      .filter(({ interval }) => interval.startMs < windowEndMs && windowStartMs < interval.endMs)
      .sort((left, right) => left.interval.startMs - right.interval.startMs)
      .map(({ trip }) => ({ tripId: trip.id, start: trip.start, end: trip.end }));
  }

  /** Встык (одна закончилась ровно тогда, когда началась другая) — не пересечение. */
  private findOverlappingTrip(candidate: Trip): Trip | undefined {
    const candidateInterval = tripInterval(candidate);
    return this.repository.all().find((existing) => {
      if (existing.id === candidate.id) return false;
      const existingInterval = tripInterval(existing);
      return (
        existingInterval.startMs < candidateInterval.endMs &&
        candidateInterval.startMs < existingInterval.endMs
      );
    });
  }
}
