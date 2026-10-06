import { randomUUID } from "expo-crypto";
import type { StateCreator } from "zustand";
import { busyRangesOfDay } from "../../domain/freeTime";
import {
  buildTripFromDraft,
  checkDraftTimes,
  createDraft,
  draftFromTrip,
  mapServerFieldErrors,
  tripChangesOf,
  type DraftErrors,
  type DraftField,
  type TripDraft,
} from "../../domain/tripDraft";
import { tripsApi, TripsApiError } from "../../services/tripsApi";
import type { DayReport, Trip } from "../../types/api";
import { formatMoney, formatTimeInZone } from "../../utils/format";
import type { AppState } from "../useAppStore";

export type EditableDraftFields = Omit<TripDraft, "id" | "date">;

export type TripFormMode = { kind: "create" } | { kind: "edit"; tripId: string };

export interface TripFormSlice {
  isTripFormOpen: boolean;
  formMode: TripFormMode;
  draft: TripDraft | null;
  /** Каким черновик был при открытии — чтобы спросить перед закрытием, если что-то изменили */
  initialDraft: TripDraft | null;
  draftErrors: DraftErrors;
  isSubmitting: boolean;
  submitMessage: string | null;
  openAddTrip: () => void;
  openEditTrip: (trip: Trip) => void;
  closeTripForm: () => void;
  updateDraft: (patch: Partial<EditableDraftFields>) => void;
  submitDraft: () => Promise<void>;
}

const DEFAULT_TZ_OFFSET = "+05:00";

const ERROR_FIELD_BY_DRAFT_KEY: Record<keyof EditableDraftFields, DraftField> = {
  startTime: "start",
  endTime: "end",
  endsNextDay: "end",
  amount: "amount",
  commission: "commission",
  payment: "payment",
};

const CLOSED_FORM = {
  isTripFormOpen: false,
  draft: null,
  initialDraft: null,
  draftErrors: {},
  submitMessage: null,
} as const;

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

function withoutErrorsFor(errors: DraftErrors, patch: Partial<EditableDraftFields>): DraftErrors {
  const remaining: DraftErrors = { ...errors };
  for (const key of Object.keys(patch) as (keyof EditableDraftFields)[]) {
    delete remaining[ERROR_FIELD_BY_DRAFT_KEY[key]];
  }
  return remaining;
}

function editedTripId(mode: TripFormMode): string | undefined {
  return mode.kind === "edit" ? mode.tripId : undefined;
}

/** Занято ли время, проверяем ещё до запроса: незачем ждать отказ сервера. */
function timeErrorsOf(draft: TripDraft, report: DayReport | null, mode: TripFormMode): DraftErrors {
  if (!report) return {};
  const ranges = busyRangesOfDay(report.date, report.tzOffset, report.busy, editedTripId(mode));
  return checkDraftTimes(draft, ranges).errors;
}

function saveTrip(mode: TripFormMode, trip: Trip): Promise<{ date: string }> {
  return mode.kind === "create"
    ? tripsApi.addTrip(trip)
    : tripsApi.updateTrip(mode.tripId, tripChangesOf(trip));
}

export const createTripFormSlice: StateCreator<AppState, [], [], TripFormSlice> = (set, get) => ({
  ...CLOSED_FORM,
  formMode: { kind: "create" },
  isSubmitting: false,

  openAddTrip() {
    const date = get().selectedDate;
    if (!date) return;
    const draft = createDraft(randomUUID(), date);
    set({ ...CLOSED_FORM, isTripFormOpen: true, formMode: { kind: "create" }, draft, initialDraft: draft });
  },

  openEditTrip(trip) {
    const tzOffset = get().dayReport?.tzOffset ?? DEFAULT_TZ_OFFSET;
    const draft = draftFromTrip(trip, tzOffset);
    set({
      ...CLOSED_FORM,
      isTripFormOpen: true,
      formMode: { kind: "edit", tripId: trip.id },
      draft,
      initialDraft: draft,
    });
  },

  closeTripForm() {
    if (get().isSubmitting) return;
    set(CLOSED_FORM);
  },

  updateDraft(patch) {
    const draft = get().draft;
    if (!draft) return;
    set({
      draft: { ...draft, ...patch },
      draftErrors: withoutErrorsFor(get().draftErrors, patch),
      submitMessage: null,
    });
  },

  async submitDraft() {
    const { draft, isSubmitting, formMode } = get();
    if (!draft || isSubmitting) return;

    const tzOffset = get().dayReport?.tzOffset ?? DEFAULT_TZ_OFFSET;
    const built = buildTripFromDraft(draft, tzOffset);
    const timeErrors = timeErrorsOf(draft, get().dayReport, formMode);
    if (!built.ok || Object.keys(timeErrors).length > 0) {
      set({ draftErrors: { ...(built.ok ? {} : built.errors), ...timeErrors }, submitMessage: null });
      return;
    }

    set({ isSubmitting: true, submitMessage: null });
    try {
      const { date } = await saveTrip(formMode, built.trip);
      set({ ...CLOSED_FORM, isSubmitting: false });
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
