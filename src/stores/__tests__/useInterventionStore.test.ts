import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock supabase client before any imports that transitively pull it
vi.mock('../../utils/supabaseClient', () => ({
  getSupabaseClient: vi.fn(() => null),
}))

import { useInterventionStore } from '../useInterventionStore'
import { setActiveUserId } from '../../utils/userStorage'

const USER_ID = 'store-test-user'

// Helper: reset zustand store state and localStorage between tests
const resetStore = () => {
  useInterventionStore.getState().reset()
}

describe('useInterventionStore', () => {
  beforeEach(() => {
    localStorage.clear()
    setActiveUserId(USER_ID)
    resetStore()
  })

  // ─── Initial shape ────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('has empty address fields by default', () => {
      const state = useInterventionStore.getState()
      expect(state.address).toBe('')
      expect(state.streetNumber).toBe('')
      expect(state.streetName).toBe('')
      expect(state.city).toBe('')
    })

    it('has null location coordinates by default', () => {
      const { lat, lng } = useInterventionStore.getState()
      expect(lat).toBeNull()
      expect(lng).toBeNull()
    })

    it('has empty role by default', () => {
      expect(useInterventionStore.getState().role).toBe('')
    })

    it('has null intervention tracking fields by default', () => {
      const state = useInterventionStore.getState()
      expect(state.currentInterventionId).toBeNull()
      expect(state.interventionStartedAtMs).toBeNull()
      expect(state.interventionStatus).toBeNull()
      expect(state.isTraining).toBeNull()
    })

    it('has empty history arrays by default', () => {
      const state = useInterventionStore.getState()
      expect(state.ordreInitialHistory).toEqual([])
      expect(state.ordreConduiteHistory).toEqual([])
    })

    it('has null hydrated orders by default', () => {
      const state = useInterventionStore.getState()
      expect(state.hydratedOrdreInitial).toBeNull()
      expect(state.hydratedOrdreConduite).toBeNull()
    })
  })

  // ─── setAddress ───────────────────────────────────────────────────────────

  describe('setAddress', () => {
    it('updates the address field', () => {
      useInterventionStore.getState().setAddress('15 Rue de la Paix')
      expect(useInterventionStore.getState().address).toBe('15 Rue de la Paix')
    })

    it('splits a numeric-prefixed address into streetNumber and streetName', () => {
      // The internal splitAddress regex /^(\d+\s*\w*)\s+(.+)$/ captures the
      // first word-boundary token (e.g. "42 Avenue") as streetNumber and the
      // remainder as streetName.
      useInterventionStore.getState().setAddress('42 Rue Nationale')
      const state = useInterventionStore.getState()
      // "42 Rue" (digit + optional word) is the captured streetNumber
      expect(state.streetNumber).toBe('42 Rue')
      expect(state.streetName).toBe('Nationale')
    })

    it('sets streetName only when address has no leading number', () => {
      useInterventionStore.getState().setAddress('Rue du Commerce')
      const state = useInterventionStore.getState()
      expect(state.streetNumber).toBe('')
      expect(state.streetName).toBe('Rue du Commerce')
    })

    it('handles empty address gracefully', () => {
      useInterventionStore.getState().setAddress('')
      const state = useInterventionStore.getState()
      expect(state.address).toBe('')
      expect(state.streetNumber).toBe('')
      expect(state.streetName).toBe('')
    })
  })

  // ─── setRole ──────────────────────────────────────────────────────────────

  describe('setRole', () => {
    it('updates the role field', () => {
      useInterventionStore.getState().setRole('Chef de groupe')
      expect(useInterventionStore.getState().role).toBe('Chef de groupe')
    })

    it('overwrites a previously set role', () => {
      useInterventionStore.getState().setRole('Chef de groupe')
      useInterventionStore.getState().setRole('Chef de colonne')
      expect(useInterventionStore.getState().role).toBe('Chef de colonne')
    })

    it('accepts an empty string for role', () => {
      useInterventionStore.getState().setRole('Chef de groupe')
      useInterventionStore.getState().setRole('')
      expect(useInterventionStore.getState().role).toBe('')
    })
  })

  // ─── setCity ──────────────────────────────────────────────────────────────

  describe('setCity', () => {
    it('updates city without affecting address', () => {
      useInterventionStore.getState().setAddress('10 Rue Test')
      useInterventionStore.getState().setCity('Paris')
      const state = useInterventionStore.getState()
      expect(state.city).toBe('Paris')
      expect(state.address).toBe('10 Rue Test')
    })
  })

  // ─── setCurrentIntervention ───────────────────────────────────────────────

  describe('setCurrentIntervention', () => {
    it('stores the intervention ID', () => {
      useInterventionStore.getState().setCurrentIntervention('intervention-abc')
      expect(useInterventionStore.getState().currentInterventionId).toBe('intervention-abc')
    })

    it('stores the provided startedAtMs timestamp', () => {
      useInterventionStore.getState().setCurrentIntervention('intervention-abc', 1000000)
      expect(useInterventionStore.getState().interventionStartedAtMs).toBe(1000000)
    })

    it('defaults startedAtMs to a reasonable value when not provided', () => {
      const before = Date.now()
      useInterventionStore.getState().setCurrentIntervention('intervention-xyz')
      const after = Date.now()
      const ts = useInterventionStore.getState().interventionStartedAtMs
      expect(ts).not.toBeNull()
      expect(ts!).toBeGreaterThanOrEqual(before)
      expect(ts!).toBeLessThanOrEqual(after)
    })
  })

  // ─── setInterventionMeta ──────────────────────────────────────────────────

  describe('setInterventionMeta', () => {
    it('updates interventionStatus', () => {
      useInterventionStore.getState().setInterventionMeta({ status: 'closed' })
      expect(useInterventionStore.getState().interventionStatus).toBe('closed')
    })

    it('updates isTraining flag', () => {
      useInterventionStore.getState().setInterventionMeta({ isTraining: true })
      expect(useInterventionStore.getState().isTraining).toBe(true)
    })

    it('does not reset unrelated fields when only one meta field is updated', () => {
      useInterventionStore.getState().setInterventionMeta({ isTraining: true, trainingSetAt: '2024-01-01T00:00:00Z' })
      useInterventionStore.getState().setInterventionMeta({ status: 'open' })
      const state = useInterventionStore.getState()
      expect(state.isTraining).toBe(true)
      expect(state.trainingSetAt).toBe('2024-01-01T00:00:00Z')
      expect(state.interventionStatus).toBe('open')
    })
  })

  // ─── reset ────────────────────────────────────────────────────────────────

  describe('reset', () => {
    it('clears address and role back to defaults', () => {
      useInterventionStore.getState().setAddress('99 Boulevard Haussmann')
      useInterventionStore.getState().setRole('Chef de site')
      useInterventionStore.getState().reset()
      const state = useInterventionStore.getState()
      expect(state.address).toBe('')
      expect(state.role).toBe('')
    })

    it('clears currentInterventionId', () => {
      useInterventionStore.getState().setCurrentIntervention('intervention-to-clear')
      useInterventionStore.getState().reset()
      expect(useInterventionStore.getState().currentInterventionId).toBeNull()
    })

    it('clears all hydration data', () => {
      useInterventionStore.getState().setHydrationMeta('int-1', '2024-06-01T10:00:00Z')
      useInterventionStore.getState().reset()
      const state = useInterventionStore.getState()
      expect(state.lastHydratedInterventionId).toBeNull()
      expect(state.lastHydratedAt).toBeNull()
    })

    it('resets ordreInitialHistory and ordreConduiteHistory to empty arrays', () => {
      useInterventionStore.getState().setOrdersHistory({
        ordreInitial: [{ id: 'oi-1', createdAt: '', userId: null, logicalId: null, payload: {} as never }],
        ordreConduite: [],
      })
      useInterventionStore.getState().reset()
      const state = useInterventionStore.getState()
      expect(state.ordreInitialHistory).toEqual([])
      expect(state.ordreConduiteHistory).toEqual([])
    })
  })

  // ─── clearCurrentIntervention ─────────────────────────────────────────────

  describe('clearCurrentIntervention', () => {
    it('sets currentInterventionId to null', () => {
      useInterventionStore.getState().setCurrentIntervention('int-xyz')
      useInterventionStore.getState().clearCurrentIntervention()
      expect(useInterventionStore.getState().currentInterventionId).toBeNull()
    })

    it('clears logical IDs', () => {
      useInterventionStore.getState().setLogicalIds({ oiLogicalId: 'oi-001', conduiteLogicalId: 'cd-001' })
      useInterventionStore.getState().clearCurrentIntervention()
      const state = useInterventionStore.getState()
      expect(state.oiLogicalId).toBeNull()
      expect(state.conduiteLogicalId).toBeNull()
    })
  })

  // ─── setInterventionAddress ───────────────────────────────────────────────

  describe('setInterventionAddress', () => {
    it('sets address fields from individual components when no full address is given', () => {
      useInterventionStore.getState().setInterventionAddress({
        streetNumber: '7',
        streetName: 'Rue de Rivoli',
        city: 'Paris',
      })
      const state = useInterventionStore.getState()
      expect(state.streetNumber).toBe('7')
      expect(state.streetName).toBe('Rue de Rivoli')
      expect(state.city).toBe('Paris')
      expect(state.address).toBe('7 Rue de Rivoli')
    })

    it('prefers the explicit address string when provided', () => {
      useInterventionStore.getState().setInterventionAddress({
        address: '7 Rue de Rivoli',
        streetNumber: '7',
        streetName: 'Rue de Rivoli',
        city: 'Lyon',
      })
      expect(useInterventionStore.getState().address).toBe('7 Rue de Rivoli')
    })
  })

  // ─── setLocation ──────────────────────────────────────────────────────────

  describe('setLocation', () => {
    it('stores valid lat/lng coordinates', () => {
      useInterventionStore.getState().setLocation({ lat: 48.8566, lng: 2.3522 })
      const state = useInterventionStore.getState()
      expect(state.lat).toBeCloseTo(48.8566)
      expect(state.lng).toBeCloseTo(2.3522)
    })

    it('rejects non-finite coordinates (NaN)', () => {
      useInterventionStore.getState().setLocation({ lat: NaN, lng: 2.3522 })
      // lat should remain null because the validation fails
      expect(useInterventionStore.getState().lat).toBeNull()
    })
  })
})
