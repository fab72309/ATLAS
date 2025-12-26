import { create } from 'zustand';

type InterventionState = {
  address: string;
  streetNumber: string;
  streetName: string;
  city: string;
  lat: number | null;
  lng: number | null;
  role: string;
  setAddress: (address: string) => void;
  setStreetNumber: (streetNumber: string) => void;
  setStreetName: (streetName: string) => void;
  setCity: (city: string) => void;
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
};

const STORAGE_KEY = 'atlas-intervention-meta';

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

const readStored = () => {
  if (typeof window === 'undefined') {
    return { address: '', streetNumber: '', streetName: '', city: '', lat: null, lng: null, role: '' };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Pick<InterventionState, 'address' | 'streetNumber' | 'streetName' | 'city' | 'lat' | 'lng' | 'role'>>;
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
  return { address: '', streetNumber: '', streetName: '', city: '', lat: null, lng: null, role: '' };
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

const writeStored = (state: Pick<InterventionState, 'address' | 'streetNumber' | 'streetName' | 'city' | 'lat' | 'lng' | 'role'>) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStored(state)));
  } catch (err) {
    console.error('Intervention meta write error', err);
  }
};

export const useInterventionStore = create<InterventionState>((set, get) => ({
  ...readStored(),
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
  }
}));
