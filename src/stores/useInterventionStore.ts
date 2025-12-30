import { create } from 'zustand';
import { readUserScopedJSON, writeUserScopedJSON } from '../utils/userStorage';
import type { OrdreInitial } from '../types/soiec';
import type { DominanteType } from '../components/DominantSelector';

export type HydratedOrdreInitial = {
  ordreData: OrdreInitial;
  selectedRisks: DominanteType[];
  additionalInfo: string;
  address: string;
  city: string;
  orderTime: string;
  soiecType?: string;
  validatedAtLabel?: string;
  validatedAtIso?: string;
};

export type HydratedOrdreConduite = {
  ordreConduite: OrdreInitial;
  conduiteSelectedRisks: DominanteType[];
  conduiteAdditionalInfo: string;
  conduiteAddress: string;
  conduiteCity: string;
  conduiteOrderTime: string;
  validatedAtLabel?: string;
  validatedAtIso?: string;
};

export type InterventionHistoryEntry<T> = {
  id: string;
  createdAt: string;
  userId: string | null;
  logicalId: string | null;
  payload: T;
};

type InterventionState = {
  address: string;
  streetNumber: string;
  streetName: string;
  city: string;
  lat: number | null;
  lng: number | null;
  role: string;
  currentInterventionId: string | null;
  interventionStartedAtMs: number | null;
  hydratedOrdreInitial: HydratedOrdreInitial | null;
  hydratedOrdreConduite: HydratedOrdreConduite | null;
  ordreInitialHistory: InterventionHistoryEntry<HydratedOrdreInitial>[];
  ordreConduiteHistory: InterventionHistoryEntry<HydratedOrdreConduite>[];
  oiLogicalId: string | null;
  conduiteLogicalId: string | null;
  lastHydratedInterventionId: string | null;
  lastHydratedAt: string | null;
  setAddress: (address: string) => void;
  setStreetNumber: (streetNumber: string) => void;
  setStreetName: (streetName: string) => void;
  setCity: (city: string) => void;
  setInterventionAddress: (payload: {
    address?: string | null;
    streetNumber?: string | null;
    streetName?: string | null;
    city?: string | null;
  }) => void;
  setRole: (role: string) => void;
  setLocation: (payload: {
    lat: number;
    lng: number;
    address?: string;
    city?: string;
    streetNumber?: string;
    streetName?: string;
  }) => void;
  clearLocation: () => void;
  setCurrentIntervention: (interventionId: string, startedAtMs?: number) => void;
  clearCurrentIntervention: () => void;
  setHydratedOrdreInitial: (payload: HydratedOrdreInitial | null, interventionId?: string) => void;
  setHydratedOrdreConduite: (payload: HydratedOrdreConduite | null, interventionId?: string) => void;
  setOrdersHistory: (payload: {
    ordreInitial: InterventionHistoryEntry<HydratedOrdreInitial>[];
    ordreConduite: InterventionHistoryEntry<HydratedOrdreConduite>[];
  }) => void;
  setLogicalIds: (payload: { oiLogicalId?: string | null; conduiteLogicalId?: string | null }) => void;
  setHydrationMeta: (interventionId: string, hydratedAt: string) => void;
  clearHydration: () => void;
  reset: () => void;
  hydrate: (userId: string) => void;
};

const STORAGE_KEY = 'atlas-intervention-meta';

const DEFAULT_META = {
  address: '',
  streetNumber: '',
  streetName: '',
  city: '',
  lat: null,
  lng: null,
  role: ''
};

const buildAddress = (streetNumber: string, streetName: string) => {
  const parts = [streetNumber.trim(), streetName.trim()].filter(Boolean);
  return parts.join(' ').trim();
};

const splitAddress = (address: string) => {
  const trimmed = address.trim();
  if (!trimmed) return { streetNumber: '', streetName: '' };
  const match = trimmed.match(/^(\d+\s*\w*)\s+(.+)$/);
  if (match) {
    return { streetNumber: match[1].trim(), streetName: match[2].trim() };
  }
  return { streetNumber: '', streetName: trimmed };
};

const readStored = (userId?: string) => {
  try {
    const parsed = readUserScopedJSON<
      Partial<Pick<InterventionState, 'address' | 'streetNumber' | 'streetName' | 'city' | 'lat' | 'lng' | 'role'>>
    >(STORAGE_KEY, 'local', userId);
    if (parsed) {
      const lat = typeof parsed.lat === 'number' && Number.isFinite(parsed.lat) ? parsed.lat : null;
      const lng = typeof parsed.lng === 'number' && Number.isFinite(parsed.lng) ? parsed.lng : null;
      const address = typeof parsed.address === 'string' ? parsed.address : '';
      const parsedStreetNumber = typeof parsed.streetNumber === 'string' ? parsed.streetNumber : '';
      const parsedStreetName = typeof parsed.streetName === 'string' ? parsed.streetName : '';
      let streetNumber = parsedStreetNumber;
      let streetName = parsedStreetName;
      if (!streetNumber && !streetName && address) {
        const split = splitAddress(address);
        streetNumber = split.streetNumber;
        streetName = split.streetName;
      }
      const combinedAddress = address || buildAddress(streetNumber, streetName);
      return {
        address: combinedAddress,
        streetNumber,
        streetName,
        city: typeof parsed.city === 'string' ? parsed.city : '',
        lat,
        lng,
        role: typeof parsed.role === 'string' ? parsed.role : ''
      };
    }
  } catch (err) {
    console.error('Intervention meta read error', err);
  }
  return { ...DEFAULT_META };
};

const toStored = (state: Pick<InterventionState, 'address' | 'streetNumber' | 'streetName' | 'city' | 'lat' | 'lng' | 'role'>) => ({
  address: state.address,
  streetNumber: state.streetNumber,
  streetName: state.streetName,
  city: state.city,
  lat: state.lat,
  lng: state.lng,
  role: state.role
});

const writeStored = (
  state: Pick<InterventionState, 'address' | 'streetNumber' | 'streetName' | 'city' | 'lat' | 'lng' | 'role'>,
  userId?: string
) => {
  try {
    writeUserScopedJSON(STORAGE_KEY, toStored(state), 'local', userId);
  } catch (err) {
    console.error('Intervention meta write error', err);
  }
};

export const useInterventionStore = create<InterventionState>((set, get) => ({
  ...readStored(),
  currentInterventionId: null,
  interventionStartedAtMs: null,
  hydratedOrdreInitial: null,
  hydratedOrdreConduite: null,
  ordreInitialHistory: [],
  ordreConduiteHistory: [],
  oiLogicalId: null,
  conduiteLogicalId: null,
  lastHydratedInterventionId: null,
  lastHydratedAt: null,
  setAddress: (address) => {
    const current = get();
    const split = splitAddress(address);
    const next = {
      address,
      streetNumber: split.streetNumber,
      streetName: split.streetName,
      city: current.city,
      lat: current.lat,
      lng: current.lng,
      role: current.role
    };
    writeStored(next);
    set({ address, streetNumber: split.streetNumber, streetName: split.streetName });
  },
  setStreetNumber: (streetNumber) => {
    const current = get();
    const address = buildAddress(streetNumber, current.streetName);
    const next = {
      address,
      streetNumber,
      streetName: current.streetName,
      city: current.city,
      lat: current.lat,
      lng: current.lng,
      role: current.role
    };
    writeStored(next);
    set({ address, streetNumber });
  },
  setStreetName: (streetName) => {
    const current = get();
    const address = buildAddress(current.streetNumber, streetName);
    const next = {
      address,
      streetNumber: current.streetNumber,
      streetName,
      city: current.city,
      lat: current.lat,
      lng: current.lng,
      role: current.role
    };
    writeStored(next);
    set({ address, streetName });
  },
  setCity: (city) => {
    const current = get();
    writeStored({
      address: current.address,
      streetNumber: current.streetNumber,
      streetName: current.streetName,
      city,
      lat: current.lat,
      lng: current.lng,
      role: current.role
    });
    set({ city });
  },
  setInterventionAddress: ({ address, streetNumber, streetName, city }) => {
    const current = get();
    const nextStreetNumber = typeof streetNumber === 'string' ? streetNumber : current.streetNumber;
    const nextStreetName = typeof streetName === 'string' ? streetName : current.streetName;
    const nextCity = typeof city === 'string' ? city : current.city;
    const addressValue = typeof address === 'string' ? address.trim() : '';
    let nextAddress = addressValue;
    if (!nextAddress) {
      const combined = buildAddress(nextStreetNumber, nextStreetName);
      nextAddress = combined || current.address;
    }
    const next = {
      address: nextAddress,
      streetNumber: nextStreetNumber,
      streetName: nextStreetName,
      city: nextCity,
      lat: current.lat,
      lng: current.lng,
      role: current.role
    };
    writeStored(next);
    set(next);
  },
  setRole: (role) => {
    const current = get();
    writeStored({
      address: current.address,
      streetNumber: current.streetNumber,
      streetName: current.streetName,
      city: current.city,
      lat: current.lat,
      lng: current.lng,
      role
    });
    set({ role });
  },
  setLocation: ({ lat, lng, address, city, streetNumber, streetName }) => {
    const current = get();
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      console.error('Invalid intervention coordinates', { lat, lng });
      return;
    }
    let nextStreetNumber = typeof streetNumber === 'string' ? streetNumber : current.streetNumber;
    let nextStreetName = typeof streetName === 'string' ? streetName : current.streetName;
    let nextAddress = typeof address === 'string' ? address : current.address;
    if (typeof address === 'string') {
      if (!streetNumber && !streetName && address.trim()) {
        const split = splitAddress(address);
        nextStreetNumber = split.streetNumber;
        nextStreetName = split.streetName;
      }
    } else {
      const combined = buildAddress(nextStreetNumber, nextStreetName);
      if (combined) nextAddress = combined;
    }
    if (!nextAddress) {
      const combined = buildAddress(nextStreetNumber, nextStreetName);
      if (combined) nextAddress = combined;
    }
    const next = {
      address: nextAddress,
      streetNumber: nextStreetNumber,
      streetName: nextStreetName,
      city: city ?? current.city,
      lat,
      lng,
      role: current.role
    };
    writeStored(next);
    set(next);
  },
  clearLocation: () => {
    const current = get();
    writeStored({
      address: current.address,
      streetNumber: current.streetNumber,
      streetName: current.streetName,
      city: current.city,
      lat: null,
      lng: null,
      role: current.role
    });
    set({ lat: null, lng: null });
  },
  setCurrentIntervention: (interventionId, startedAtMs) => {
    set({
      currentInterventionId: interventionId,
      interventionStartedAtMs: startedAtMs ?? Date.now()
    });
  },
  clearCurrentIntervention: () => {
    set({
      currentInterventionId: null,
      interventionStartedAtMs: null,
      hydratedOrdreInitial: null,
      hydratedOrdreConduite: null,
      ordreInitialHistory: [],
      ordreConduiteHistory: [],
      oiLogicalId: null,
      conduiteLogicalId: null,
      lastHydratedInterventionId: null,
      lastHydratedAt: null
    });
  },
  setHydratedOrdreInitial: (payload, interventionId) => {
    set((state) => ({
      hydratedOrdreInitial: payload,
      lastHydratedInterventionId: interventionId ?? state.lastHydratedInterventionId
    }));
  },
  setHydratedOrdreConduite: (payload, interventionId) => {
    set((state) => ({
      hydratedOrdreConduite: payload,
      lastHydratedInterventionId: interventionId ?? state.lastHydratedInterventionId
    }));
  },
  setOrdersHistory: ({ ordreInitial, ordreConduite }) => {
    set({
      ordreInitialHistory: ordreInitial,
      ordreConduiteHistory: ordreConduite
    });
  },
  setLogicalIds: ({ oiLogicalId, conduiteLogicalId }) => {
    set((state) => ({
      oiLogicalId: oiLogicalId ?? state.oiLogicalId,
      conduiteLogicalId: conduiteLogicalId ?? state.conduiteLogicalId
    }));
  },
  setHydrationMeta: (interventionId, hydratedAt) => {
    set({ lastHydratedInterventionId: interventionId, lastHydratedAt: hydratedAt });
  },
  clearHydration: () => {
    set({
      hydratedOrdreInitial: null,
      hydratedOrdreConduite: null,
      ordreInitialHistory: [],
      ordreConduiteHistory: [],
      oiLogicalId: null,
      conduiteLogicalId: null,
      lastHydratedInterventionId: null,
      lastHydratedAt: null
    });
  },
  reset: () => {
    writeStored(DEFAULT_META);
    set({
      ...DEFAULT_META,
      currentInterventionId: null,
      interventionStartedAtMs: null,
      hydratedOrdreInitial: null,
      hydratedOrdreConduite: null,
      ordreInitialHistory: [],
      ordreConduiteHistory: [],
      oiLogicalId: null,
      conduiteLogicalId: null,
      lastHydratedInterventionId: null,
      lastHydratedAt: null
    });
  },
  hydrate: (userId: string) => {
    const stored = readStored(userId);
    set({
      ...stored,
      currentInterventionId: null,
      interventionStartedAtMs: null,
      hydratedOrdreInitial: null,
      hydratedOrdreConduite: null,
      ordreInitialHistory: [],
      ordreConduiteHistory: [],
      oiLogicalId: null,
      conduiteLogicalId: null,
      lastHydratedInterventionId: null,
      lastHydratedAt: null
    });
  }
}));
