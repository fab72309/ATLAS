import '@testing-library/jest-dom'

// Node 25 introduces a native localStorage backed by --localstorage-file.
// When vitest forks workers the flag may be passed without a valid path, which
// produces a stub that is missing the full Storage API (e.g. .clear()).
// Patch the global so tests that call localStorage.clear() always work.
if (typeof localStorage !== 'undefined' && typeof localStorage.clear !== 'function') {
  const store: Record<string, string> = {}
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = String(value) },
      removeItem: (key: string) => { delete store[key] },
      clear: () => { Object.keys(store).forEach((k) => delete store[k]) },
      get length() { return Object.keys(store).length },
      key: (index: number) => Object.keys(store)[index] ?? null,
    },
    writable: true,
    configurable: true,
  })
}
