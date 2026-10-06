import { create } from "zustand";
import { createAddTripSlice, type AddTripSlice } from "./slices/addTripSlice";
import { createDaySlice, type DaySlice } from "./slices/daySlice";

export type AppState = DaySlice & AddTripSlice;

export const useAppStore = create<AppState>()((...storeArgs) => ({
  ...createDaySlice(...storeArgs),
  ...createAddTripSlice(...storeArgs),
}));
