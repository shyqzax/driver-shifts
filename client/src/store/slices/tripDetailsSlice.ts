import type { StateCreator } from "zustand";
import { tripsApi, TripsApiError } from "../../services/tripsApi";
import type { AppState } from "../useAppStore";

export interface TripDetailsSlice {
  /** Поездка, открытая в окне просмотра; сами данные берутся из отчёта дня */
  viewedTripId: string | null;
  isDeletingTrip: boolean;
  detailsMessage: string | null;
  openTripDetails: (tripId: string) => void;
  closeTripDetails: () => void;
  editViewedTrip: () => void;
  deleteViewedTrip: () => Promise<void>;
}

function describeDeleteError(error: unknown): string {
  if (error instanceof TripsApiError && error.status === null) {
    return "Нет связи с сервером. Нажмите «Удалить» ещё раз.";
  }
  return error instanceof TripsApiError ? error.message : "Не удалось удалить поездку";
}

function isAlreadyDeleted(error: unknown): boolean {
  return error instanceof TripsApiError && error.status === 404;
}

export const createTripDetailsSlice: StateCreator<AppState, [], [], TripDetailsSlice> = (set, get) => ({
  viewedTripId: null,
  isDeletingTrip: false,
  detailsMessage: null,

  openTripDetails(tripId) {
    set({ viewedTripId: tripId, detailsMessage: null });
  },

  closeTripDetails() {
    if (get().isDeletingTrip) return;
    set({ viewedTripId: null, detailsMessage: null });
  },

  editViewedTrip() {
    const trip = get().dayReport?.trips.find((candidate) => candidate.id === get().viewedTripId);
    if (!trip) return;
    set({ viewedTripId: null, detailsMessage: null });
    get().openEditTrip(trip);
  },

  async deleteViewedTrip() {
    const { viewedTripId, isDeletingTrip } = get();
    if (!viewedTripId || isDeletingTrip) return;

    set({ isDeletingTrip: true, detailsMessage: null });
    try {
      await tripsApi.deleteTrip(viewedTripId);
    } catch (error) {
      // 404 после обрыва связи значит, что первая попытка всё-таки дошла
      if (!isAlreadyDeleted(error)) {
        set({ isDeletingTrip: false, detailsMessage: describeDeleteError(error) });
        return;
      }
    }
    set({ isDeletingTrip: false, viewedTripId: null });
    await get().reloadDay();
  },
});
