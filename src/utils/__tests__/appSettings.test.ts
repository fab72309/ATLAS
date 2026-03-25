import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock supabaseClient before importing anything that imports it
vi.mock('../../utils/supabaseClient', () => ({
  getSupabaseClient: vi.fn(() => null),
}))

// We test the module-level pure logic by importing the module.
// readAppSettings and writeAppSettings depend on userStorage which reads localStorage.
// The JSDOM environment provides a working localStorage implementation.
import {
  readAppSettings,
  writeAppSettings,
  updateAppSettings,
} from '../appSettings'
import { setActiveUserId } from '../userStorage'

const STORAGE_PREFIX = 'atlas:v1'
const STORAGE_KEY = 'atlas-app-settings'
const USER_ID = 'test-user-123'

const buildKey = (userId: string) => `${STORAGE_PREFIX}:${userId}:${STORAGE_KEY}`

describe('appSettings', () => {
  beforeEach(() => {
    localStorage.clear()
    setActiveUserId(USER_ID)
  })

  describe('readAppSettings – defaults', () => {
    it('returns default settings when localStorage is empty', () => {
      setActiveUserId(null)
      const settings = readAppSettings()
      expect(settings.defaultOperationalTab).toBe('moyens')
      expect(settings.openaiProxyUrlOverride).toBe('')
    })

    it('returns default settings when no active user is set', () => {
      setActiveUserId(null)
      const result = readAppSettings()
      expect(result).toEqual({
        defaultOperationalTab: 'moyens',
        openaiProxyUrlOverride: '',
      })
    })
  })

  describe('readAppSettings – sanitizeOperationalTab', () => {
    it('accepts a valid OperationalTabId from storage', () => {
      localStorage.setItem(
        buildKey(USER_ID),
        JSON.stringify({ defaultOperationalTab: 'soiec', openaiProxyUrlOverride: '' })
      )
      const settings = readAppSettings()
      expect(settings.defaultOperationalTab).toBe('soiec')
    })

    it('falls back to "moyens" for an invalid tab value', () => {
      localStorage.setItem(
        buildKey(USER_ID),
        JSON.stringify({ defaultOperationalTab: 'invalid-tab', openaiProxyUrlOverride: '' })
      )
      const settings = readAppSettings()
      expect(settings.defaultOperationalTab).toBe('moyens')
    })

    it('falls back to "moyens" when defaultOperationalTab is a number', () => {
      localStorage.setItem(
        buildKey(USER_ID),
        JSON.stringify({ defaultOperationalTab: 42, openaiProxyUrlOverride: '' })
      )
      const settings = readAppSettings()
      expect(settings.defaultOperationalTab).toBe('moyens')
    })

    it('accepts all valid OperationalTabId values', () => {
      const validTabs = ['moyens', 'message', 'soiec', 'oct', 'sitac', 'aide'] as const
      for (const tab of validTabs) {
        localStorage.setItem(
          buildKey(USER_ID),
          JSON.stringify({ defaultOperationalTab: tab, openaiProxyUrlOverride: '' })
        )
        const settings = readAppSettings()
        expect(settings.defaultOperationalTab).toBe(tab)
      }
    })
  })

  describe('readAppSettings – sanitizeUrlOverride', () => {
    it('trims whitespace from openaiProxyUrlOverride', () => {
      localStorage.setItem(
        buildKey(USER_ID),
        JSON.stringify({ defaultOperationalTab: 'moyens', openaiProxyUrlOverride: '  https://proxy.example.com  ' })
      )
      const settings = readAppSettings()
      expect(settings.openaiProxyUrlOverride).toBe('https://proxy.example.com')
    })

    it('returns empty string when openaiProxyUrlOverride is not a string', () => {
      localStorage.setItem(
        buildKey(USER_ID),
        JSON.stringify({ defaultOperationalTab: 'moyens', openaiProxyUrlOverride: 12345 })
      )
      const settings = readAppSettings()
      expect(settings.openaiProxyUrlOverride).toBe('')
    })

    it('preserves a valid URL override as-is', () => {
      localStorage.setItem(
        buildKey(USER_ID),
        JSON.stringify({ defaultOperationalTab: 'moyens', openaiProxyUrlOverride: 'https://custom.proxy/api' })
      )
      const settings = readAppSettings()
      expect(settings.openaiProxyUrlOverride).toBe('https://custom.proxy/api')
    })
  })

  describe('writeAppSettings', () => {
    it('persists settings to localStorage', () => {
      writeAppSettings({ defaultOperationalTab: 'sitac', openaiProxyUrlOverride: 'http://test' })
      const raw = localStorage.getItem(buildKey(USER_ID))
      expect(raw).not.toBeNull()
      const parsed = JSON.parse(raw!)
      expect(parsed.defaultOperationalTab).toBe('sitac')
      expect(parsed.openaiProxyUrlOverride).toBe('http://test')
    })

    it('written settings can be read back via readAppSettings', () => {
      const toWrite = { defaultOperationalTab: 'oct' as const, openaiProxyUrlOverride: 'https://api.example.com' }
      writeAppSettings(toWrite)
      const read = readAppSettings()
      expect(read).toEqual(toWrite)
    })
  })

  describe('updateAppSettings', () => {
    it('applies updater function and returns updated settings', () => {
      writeAppSettings({ defaultOperationalTab: 'moyens', openaiProxyUrlOverride: '' })
      const result = updateAppSettings((prev) => ({
        ...prev,
        defaultOperationalTab: 'aide',
      }))
      expect(result.defaultOperationalTab).toBe('aide')
    })

    it('persists the updated settings so readAppSettings returns them', () => {
      writeAppSettings({ defaultOperationalTab: 'moyens', openaiProxyUrlOverride: '' })
      updateAppSettings((prev) => ({ ...prev, openaiProxyUrlOverride: 'https://updated.proxy' }))
      const read = readAppSettings()
      expect(read.openaiProxyUrlOverride).toBe('https://updated.proxy')
    })
  })
})
