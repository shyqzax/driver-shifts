import type { StateCreator } from "zustand";
import { tripsApi, TripsApiError } from "../../services/tripsApi";
import type { DayOverview, DayReport } from "../../types/api";
import { addDays } from "../../utils/format";
import type { AppState } from "../useAppStore";

export type LoadStatus = "idle" | "loading" | "ready" | "error";

export interface DaySlice {
  /** Дни, в которые есть поездки, — для быстрых переходов */
  days: DayOverview[];
  selectedDate: string | null;
  dayReport: DayReport | null;
  dayStatus: LoadStatus;
  dayError: string | null;
  loadInitialDay: () => Promise<void>;
  selectDate: (date: string) => Promise<void>;
  shiftSelectedDate: (deltaDays: number) => Promise<void>;
  reloadDay: () => Promise<void>;
  refreshDays: () => Promise<void>;
}

const OFFLINE_HINT = "Нет связи с сервером. Проверьте, что он запущен: npm run dev в папке server.";

function describeLoadError(error: unknown): string {
  if (error instanceof TripsApiError) {
    return error.status === null ? OFFLINE_HINT : error.message;
  }
  return "Не удалось загрузить данные";
}

function localToday(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export const createDaySlice: StateCreator<AppState, [], [], DaySlice> = (set, get) => ({
  days: [],
  selectedDate: null,
  dayReport: null,
  dayStatus: "idle",
  dayError: null,

  async loadInitialDay() {
    set({ dayStatus: "loading", dayError: null });
    try {
      const days = await tripsApi.fetchDays();
      set({ days });
      // Открываем последний день с поездками: в демо-данных «сегодня» обычно пусто
      await get().selectDate(days[days.length - 1]?.date ?? localToday());
    } catch (error) {
      set({ dayStatus: "error", dayError: describeLoadError(error) });
    }
  },

  async selectDate(date) {
    const keepsCurrentReport = get().dayReport?.date === date;
    set({
      selectedDate: date,
      dayStatus: "loading",
      dayError: null,
      dayReport: keepsCurrentReport ? get().dayReport : null,
    });
    try {
      const report = await tripsApi.fetchDay(date);
      // Пока шёл запрос, водитель мог уйти на другой день — старый ответ не нужен
      if (get().selectedDate !== date) return;
      set({ dayReport: report, dayStatus: "ready" });
    } catch (error) {
      if (get().selectedDate !== date) return;
      set({ dayStatus: "error", dayError: describeLoadError(error) });
    }
  },

  async shiftSelectedDate(deltaDays) {
    const current = get().selectedDate;
    if (!current) return;
    await get().selectDate(addDays(current, deltaDays));
  },

  async reloadDay() {
    const current = get().selectedDate;
    if (!current) {
      await get().loadInitialDay();
      return;
    }
    await Promise.all([get().refreshDays(), get().selectDate(current)]);
  },

  async refreshDays() {
    try {
      set({ days: await tripsApi.fetchDays() });
    } catch {
      // Список дней — подсказка для навигации; без свежего можно жить
    }
  },
});
