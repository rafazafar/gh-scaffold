import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      thresholds: {
        lines: 88,
        functions: 81,
        branches: 70,
        statements: 83
      },
      exclude: ['dist/**', '**/*.d.ts'],
    },
  },
});
