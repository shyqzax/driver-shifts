import Constants from "expo-constants";
import { Platform } from "react-native";
import type {
  AddTripResponse,
  ApiErrorBody,
  DayOverview,
  DayReport,
  Trip,
} from "../types/api";

const API_PORT = 3000;

/**
 * Адрес сервера. На телефоне с Expo Go `localhost` — это сам телефон, поэтому
 * берём адрес компьютера, с которого Expo раздаёт приложение. Явный
 * `EXPO_PUBLIC_API_URL` важнее догадок (нужен для демо и эмулятора).
 */
function resolveApiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  if (configured) return configured.replace(/\/$/, "");

  if (Platform.OS === "web" && typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:${API_PORT}`;
  }
  const devMachineHost = Constants.expoConfig?.hostUri?.split(":")[0];
  return `http://${devMachineHost ?? "localhost"}:${API_PORT}`;
}

const API_BASE_URL = resolveApiBaseUrl();

/** `status === null` — ответа не было вообще (нет сети, сервер не запущен). */
export class TripsApiError extends Error {
  constructor(
    readonly status: number | null,
    readonly body: ApiErrorBody | null,
    message: string
  ) {
    super(message);
    this.name = "TripsApiError";
  }
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.code === "string" && typeof record.message === "string";
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Без предела зависший сервер крутил бы индикатор вечно. Повтор после
 * тайм-аута безопасен: поездка уходит с тем же id и дубля не будет.
 */
const REQUEST_TIMEOUT_MS = 10_000;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...init, signal: controller.signal });
  } catch {
    throw new TripsApiError(null, null, "Нет связи с сервером");
  } finally {
    clearTimeout(timeout);
  }

  const body = await readJson(response);
  if (response.ok) return body as T;

  const errorBody = isApiErrorBody(body) ? body : null;
  throw new TripsApiError(
    response.status,
    errorBody,
    errorBody?.message ?? `Сервер ответил ошибкой ${response.status}`
  );
}

export const tripsApi = {
  fetchDays(): Promise<DayOverview[]> {
    return request<DayOverview[]>("/v1/days");
  },

  fetchDay(date: string): Promise<DayReport> {
    return request<DayReport>(`/v1/days/${date}`);
  },

  addTrip(trip: Trip): Promise<AddTripResponse> {
    return request<AddTripResponse>("/v1/trips", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(trip),
    });
  },
};
