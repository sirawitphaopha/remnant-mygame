import { defineConfig } from 'vitest/config';

export default defineConfig({
  server: { port: 3700, strictPort: true },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
