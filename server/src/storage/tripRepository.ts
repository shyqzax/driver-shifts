import type { Trip } from "../domain/trip";

/**
 * Контракт хранилища устроен так, чтобы проверка «нет ли уже такой поездки» и
 * вставка шли без ожидания между ними: `insert` кладёт поездку в память СРАЗУ
 * при вызове, а обещание завершается, когда запись сохранена. Node выполняет
 * синхронный код без перерывов, поэтому два одновременных запроса с одной
 * поездкой не могут оба пройти проверку.
 */
export interface TripRepository {
  all(): readonly Trip[];
  findById(id: string): Trip | undefined;
  insert(trip: Trip): Promise<void>;
}

export class InMemoryTripRepository implements TripRepository {
  protected readonly tripsById = new Map<string, Trip>();

  constructor(initialTrips: readonly Trip[] = []) {
    for (const trip of initialTrips) {
      this.tripsById.set(trip.id, trip);
    }
  }

  all(): readonly Trip[] {
    return [...this.tripsById.values()];
  }

  findById(id: string): Trip | undefined {
    return this.tripsById.get(id);
  }

  insert(trip: Trip): Promise<void> {
    this.tripsById.set(trip.id, trip);
    return Promise.resolve();
  }
}
