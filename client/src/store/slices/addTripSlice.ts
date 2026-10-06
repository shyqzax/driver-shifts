import { randomUUID } from "expo-crypto";
import type { StateCreator } from "zustand";
import { busyRangesOfDay, isEndStillAllowed } from "../../domain/freeTime";
import {
  buildTripFromDraft,
  createDraft,
  mapServerFieldErrors,
  type DraftErrors,
  type DraftField,
  type TripDraft,
} from "../../domain/tripDraft";
import type { DayReport } from "../../types/api";
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

const ERROR_FIELD_BY_DRAFT_KEY: Record<keyof EditableDraftFields, DraftField> = {
  startMinute: "start",
  endMinute: "end",
  amount: "amount",
  commission: "commission",
  payment: "payment",
};

function withoutErrorsFor(errors: DraftErrors, patch: Partial<EditableDraftFields>): DraftErrors {
  const remaining: DraftErrors = { ...errors };
  for (const key of Object.keys(patch) as (keyof EditableDraftFields)[]) {
    delete remaining[ERROR_FIELD_BY_DRAFT_KEY[key]];
  }
  return remaining;
}

/** Новое начало может «съесть» выбранное окончание — тогда его надо выбрать заново. */
function keepEndIfStillAllowed(draft: TripDraft, report: DayReport | null): TripDraft {
  if (draft.startMinute === null || draft.endMinute === null || !report) return draft;
  const ranges = busyRangesOfDay(report.date, report.tzOffset, report.busy);
  return isEndStillAllowed(draft.startMinute, draft.endMinute, ranges)
    ? draft
    : { ...draft, endMinute: null };
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
    const updated = { ...draft, ...patch };
    set({
      draft: "startMinute" in patch ? keepEndIfStillAllowed(updated, get().dayReport) : updated,
      draftErrors: withoutErrorsFor(get().draftErrors, patch),
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
      // Время заняли с другого устройства — обновляем день, чтобы выбор времени это учёл
      if (error instanceof TripsApiError && error.body?.code === "trip_overlap") {
        await get().selectDate(draft.date);
      }
    }
  },
});
