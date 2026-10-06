import { create } from "zustand";
import { createDaySlice, type DaySlice } from "./slices/daySlice";
import { createTripDetailsSlice, type TripDetailsSlice } from "./slices/tripDetailsSlice";
import { createTripFormSlice, type TripFormSlice } from "./slices/tripFormSlice";

export type AppState = DaySlice & TripFormSlice & TripDetailsSlice;

export const useAppStore = create<AppState>()((...storeArgs) => ({
  ...createDaySlice(...storeArgs),
  ...createTripFormSlice(...storeArgs),
  ...createTripDetailsSlice(...storeArgs),
}));
