import { randomUUID } from "expo-crypto";
import type { StateCreator } from "zustand";
import {
  buildTripFromDraft,
  createDraft,
  mapServerFieldErrors,
  type DraftErrors,
  type DraftField,
  type TripDraft,
} from "../../domain/tripDraft";
import { tripsApi, TripsApiError } from "../../services/tripsApi";
import { formatMoney, formatTimeInZone } from "../../utils/format";
import type { AppState } from "../useAppStore";

export type EditableDraftFields = Omit<TripDraft, "id" | "date">;

export interface AddTripSlice {
  isAddTripOpen: boolean;
  draft: TripDraft | null;
  draftErrors: DraftErrors;
  isSubmitting: boolean;
  submitMessage: string | null;
  openAddTrip: () => void;
  closeAddTrip: () => void;
  updateDraft: (patch: Partial<EditableDraftFields>) => void;
  submitDraft: () => Promise<void>;
}

const DEFAULT_TZ_OFFSET = "+05:00";

function describeSubmitError(error: unknown, tzOffset: string): string {
  if (!(error instanceof TripsApiError)) return "Не удалось сохранить поездку";
  if (error.status === null) {
    return "Нет связи с сервером. Нажмите «Сохранить» ещё раз — поездка не задвоится.";
  }

  const conflicting = error.body?.conflictingTrip;
  if (error.body?.code === "trip_overlap" && conflicting) {
    const start = formatTimeInZone(conflicting.start, tzOffset);
    const end = formatTimeInZone(conflicting.end, tzOffset);
    return `Пересекается с поездкой ${start}–${end} на ${formatMoney(conflicting.amount)}`;
  }
  if (error.body?.code === "trip_id_conflict") {
    return "Эта поездка уже сохранена раньше с другими данными. Закройте форму и проверьте список.";
  }
  return error.message;
}

function withoutErrorsFor(errors: DraftErrors, fields: readonly string[]): DraftErrors {
  const remaining: DraftErrors = { ...errors };
  for (const field of fields) {
    delete remaining[field as DraftField];
  }
  return remaining;
}

export const createAddTripSlice: StateCreator<AppState, [], [], AddTripSlice> = (set, get) => ({
  isAddTripOpen: false,
  draft: null,
  draftErrors: {},
  isSubmitting: false,
  submitMessage: null,

  openAddTrip() {
    const date = get().selectedDate;
    if (!date) return;
    set({
      isAddTripOpen: true,
      draft: createDraft(randomUUID(), date),
      draftErrors: {},
      submitMessage: null,
    });
  },

  closeAddTrip() {
    if (get().isSubmitting) return;
    set({ isAddTripOpen: false, draft: null, draftErrors: {}, submitMessage: null });
  },

  updateDraft(patch) {
    const draft = get().draft;
    if (!draft) return;
    // Галочка «после полуночи» меняет дату окончания — старая ошибка у него больше не верна
    const touchedFields = Object.keys(patch).map((key) => (key === "endsNextDay" ? "endTime" : key));
    set({
      draft: { ...draft, ...patch },
      draftErrors: withoutErrorsFor(get().draftErrors, touchedFields),
      submitMessage: null,
    });
  },

  async submitDraft() {
    const { draft, isSubmitting } = get();
    if (!draft || isSubmitting) return;

    const tzOffset = get().dayReport?.tzOffset ?? DEFAULT_TZ_OFFSET;
    const built = buildTripFromDraft(draft, tzOffset);
    if (!built.ok) {
      set({ draftErrors: built.errors, submitMessage: null });
      return;
    }

    set({ isSubmitting: true, submitMessage: null });
    try {
      const { date } = await tripsApi.addTrip(built.trip);
      set({ isSubmitting: false, isAddTripOpen: false, draft: null, draftErrors: {} });
      await Promise.all([get().refreshDays(), get().selectDate(date)]);
    } catch (error) {
      const fields = error instanceof TripsApiError ? error.body?.fields : undefined;
      set({
        isSubmitting: false,
        draftErrors: mapServerFieldErrors(fields),
        submitMessage: describeSubmitError(error, tzOffset),
      });
    }
  },
});
