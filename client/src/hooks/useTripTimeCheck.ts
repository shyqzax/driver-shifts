import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { busyRangesOfDay } from "../domain/freeTime";
import { checkDraftTimes, type TimeCheck } from "../domain/tripDraft";
import { useAppStore } from "../store/useAppStore";

const NO_PROBLEMS: TimeCheck = { errors: {} };

/** Подсказки по введённому времени из занятого времени дня, которое прислал сервер. */
export function useTripTimeCheck(): TimeCheck {
  const report = useAppStore((state) => state.dayReport);
  // При редактировании своё же время поездке не мешает
  const editedTripId = useAppStore((state) =>
    state.formMode.kind === "edit" ? state.formMode.tripId : undefined
  );
  const draftTimes = useAppStore(
    useShallow((state) =>
      state.draft
        ? { startTime: state.draft.startTime, endTime: state.draft.endTime, endsNextDay: state.draft.endsNextDay }
        : null
    )
  );

  const ranges = useMemo(
    () => (report ? busyRangesOfDay(report.date, report.tzOffset, report.busy, editedTripId) : []),
    [report, editedTripId]
  );

  return useMemo(() => (draftTimes ? checkDraftTimes(draftTimes, ranges) : NO_PROBLEMS), [draftTimes, ranges]);
}
