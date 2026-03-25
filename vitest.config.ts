import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import os from 'node:os'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    pool: 'forks',
    poolOptions: {
      forks: {
        // Node 25 exposes a native localStorage via --localstorage-file; provide a
        // valid temp path so the flag is satisfied and the full Storage API (including
        // .clear()) is available.  jsdom's own Storage will take precedence inside the
        // jsdom environment, but this avoids the "invalid path" warning/stub.
        execArgv: [`--localstorage-file=${path.join(os.tmpdir(), 'vitest-ls.db')}`],
      },
    },
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
})
