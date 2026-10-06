import { copyFile, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { isPaymentMethod, type Trip } from "../domain/trip";
import { validateTrip } from "../domain/validateTrip";
import { InMemoryTripRepository } from "./tripRepository";

export interface JsonFileTripRepositoryOptions {
  dataFile: string;
  /** Откуда взять начальные данные, если рабочего файла ещё нет */
  seedFile?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTripShape(value: unknown): value is Trip {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.start === "string" &&
    typeof value.end === "string" &&
    typeof value.amount === "number" &&
    typeof value.commission === "number" &&
    isPaymentMethod(value.payment)
  );
}

/** Битый файл данных — повод не стартовать, а не тихо потерять поездки. */
function parseTripsFile(text: string, fileName: string): Trip[] {
  const parsed: unknown = JSON.parse(text);
  if (!Array.isArray(parsed)) {
    throw new Error(`${fileName}: ожидался массив поездок`);
  }

  const seenIds = new Set<string>();
  return parsed.map((value: unknown, index) => {
    if (!isTripShape(value)) {
      throw new Error(`${fileName}: запись №${index + 1} не похожа на поездку`);
    }
    const validation = validateTrip(value);
    if (!validation.ok) {
      const details = JSON.stringify(validation.fieldErrors);
      throw new Error(`${fileName}: поездка ${value.id} не проходит проверку: ${details}`);
    }
    if (seenIds.has(value.id)) {
      throw new Error(`${fileName}: поездка ${value.id} встречается дважды`);
    }
    seenIds.add(value.id);
    return value;
  });
}

/** По поездке на строку: файл остаётся читаемым и в редакторе, и в истории git. */
function serializeTrips(trips: readonly Trip[]): string {
  return `[\n${trips.map((trip) => `  ${JSON.stringify(trip)}`).join(",\n")}\n]\n`;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function ensureDataFile({ dataFile, seedFile }: JsonFileTripRepositoryOptions): Promise<void> {
  if (await fileExists(dataFile)) return;

  await mkdir(dirname(dataFile), { recursive: true });
  if (seedFile) {
    await copyFile(seedFile, dataFile);
    return;
  }
  await writeFile(dataFile, serializeTrips([]), "utf8");
}

/**
 * Поездки живут в памяти, а файл — их копия на диске. Файл перезаписывается
 * целиком через временный (`.tmp` → rename): если процесс упадёт посреди
 * записи, на диске останется старая целая версия, а не половина JSON.
 */
export class JsonFileTripRepository extends InMemoryTripRepository {
  private writeQueue: Promise<void> = Promise.resolve();

  private constructor(
    private readonly dataFile: string,
    trips: readonly Trip[]
  ) {
    super(trips);
  }

  static async open(options: JsonFileTripRepositoryOptions): Promise<JsonFileTripRepository> {
    await ensureDataFile(options);
    const text = await readFile(options.dataFile, "utf8");
    return new JsonFileTripRepository(options.dataFile, parseTripsFile(text, options.dataFile));
  }

  override insert(trip: Trip): Promise<void> {
    this.tripsById.set(trip.id, trip);
    return this.persist().catch((error: unknown) => {
      // Не сохранили — значит, поездки нет: клиент получит ошибку и повторит запрос
      this.tripsById.delete(trip.id);
      throw error;
    });
  }

  override replace(trip: Trip): Promise<void> {
    const previous = this.tripsById.get(trip.id);
    this.tripsById.set(trip.id, trip);
    return this.persist().catch((error: unknown) => {
      if (previous) this.tripsById.set(trip.id, previous);
      throw error;
    });
  }

  override remove(id: string): Promise<void> {
    const previous = this.tripsById.get(id);
    this.tripsById.delete(id);
    return this.persist().catch((error: unknown) => {
      if (previous) this.tripsById.set(id, previous);
      throw error;
    });
  }

  /** Записи идут строго по очереди, иначе два rename могли бы обогнать друг друга. */
  private persist(): Promise<void> {
    const write = this.writeQueue.then(() => this.writeSnapshot());
    this.writeQueue = write.catch(() => undefined);
    return write;
  }

  private async writeSnapshot(): Promise<void> {
    const temporaryFile = `${this.dataFile}.tmp`;
    await writeFile(temporaryFile, serializeTrips(this.all()), "utf8");
    await rename(temporaryFile, this.dataFile);
  }
}
