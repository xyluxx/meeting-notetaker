import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Only run source tests; never the compiled copies under dist/ after a build.
    include: ['src/**/*.test.ts'],
  },
});
