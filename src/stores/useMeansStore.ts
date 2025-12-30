import { create } from 'zustand';
import type { MeanItem } from '../types/means';

type MeansState = {
  selectedMeans: MeanItem[];
  hydrationId: number;
  setSelectedMeans: (items: MeanItem[]) => void;
  setFromHydration: (items: MeanItem[]) => void;
  reset: () => void;
};

export const useMeansStore = create<MeansState>((set) => ({
  selectedMeans: [],
  hydrationId: 0,
  setSelectedMeans: (items) => set({ selectedMeans: items }),
  setFromHydration: (items) =>
    set((state) => ({ selectedMeans: items, hydrationId: state.hydrationId + 1 })),
  reset: () => set((state) => ({ selectedMeans: [], hydrationId: state.hydrationId + 1 }))
}));
