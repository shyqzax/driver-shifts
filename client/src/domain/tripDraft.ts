import type { PaymentMethod, Trip } from "../types/api";
import { addDays } from "../utils/format";

/** Форма добавления: всё, что вводит водитель, хранится как текст до отправки. */
export interface TripDraft {
  /** Номер поездки придумывается один раз при открытии формы — повторная отправка шлёт его же */
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  endsNextDay: boolean;
  amount: string;
  commission: string;
  payment: PaymentMethod;
}

export type DraftField = "startTime" | "endTime" | "amount" | "commission" | "payment";
export type DraftErrors = Partial<Record<DraftField, string>>;

export type DraftBuildResult = { ok: true; trip: Trip } | { ok: false; errors: DraftErrors };

const DEFAULT_COMMISSION_RATE = 0.15;

export function createDraft(id: string, date: string): TripDraft {
  return {
    id,
    date,
    startTime: "",
    endTime: "",
    endsNextDay: false,
    amount: "",
    commission: "",
    payment: "card",
  };
}

/** `8:10`, `08:10`, `0810` → `08:10`; всё остальное — `null`. */
export function normalizeTimeInput(text: string): string | null {
  const match = /^(\d{1,2}):?(\d{2})$/.exec(text.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** `1 500,50` → 1500.5. Копейки и знак проверяет сервер — правила живут в одном месте. */
export function parseMoneyInput(text: string): number | null {
  const compact = text.replace(/[\s ]/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(compact)) return null;
  return Number(compact);
}

export function suggestCommission(amountText: string): string | null {
  const amount = parseMoneyInput(amountText);
  if (amount === null) return null;
  return String(Math.round(amount * DEFAULT_COMMISSION_RATE * 100) / 100);
}

/**
 * Клиент проверяет только то, без чего не собрать запрос (время и числа
 * читаются). Смысловые правила — сумма больше нуля, конец позже начала —
 * проверяет сервер, и его ответ показывается у нужного поля.
 */
export function buildTripFromDraft(draft: TripDraft, tzOffset: string): DraftBuildResult {
  const startTime = normalizeTimeInput(draft.startTime);
  const endTime = normalizeTimeInput(draft.endTime);
  const amount = parseMoneyInput(draft.amount);
  const commission = parseMoneyInput(draft.commission);

  const errors: DraftErrors = {};
  if (!startTime) errors.startTime = "Время в формате ЧЧ:ММ";
  if (!endTime) errors.endTime = "Время в формате ЧЧ:ММ";
  if (amount === null) errors.amount = "Введите сумму числом";
  if (commission === null) errors.commission = "Введите комиссию числом";

  if (!startTime || !endTime || amount === null || commission === null) {
    return { ok: false, errors };
  }

  const endDate = draft.endsNextDay ? addDays(draft.date, 1) : draft.date;
  return {
    ok: true,
    trip: {
      id: draft.id,
      start: `${draft.date}T${startTime}:00${tzOffset}`,
      end: `${endDate}T${endTime}:00${tzOffset}`,
      amount,
      payment: draft.payment,
      commission,
    },
  };
}

const SERVER_FIELD_TO_DRAFT_FIELD: Partial<Record<string, DraftField>> = {
  start: "startTime",
  end: "endTime",
  amount: "amount",
  commission: "commission",
  payment: "payment",
};

export function mapServerFieldErrors(fields: Partial<Record<string, string>> | undefined): DraftErrors {
  const errors: DraftErrors = {};
  for (const [serverField, message] of Object.entries(fields ?? {})) {
    const draftField = SERVER_FIELD_TO_DRAFT_FIELD[serverField];
    if (draftField && message) errors[draftField] = message;
  }
  return errors;
}
