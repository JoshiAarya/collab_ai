import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./test/setup.js'],
    testTimeout: 30000,
    // First run downloads the mongodb-memory-server binary
    hookTimeout: 120000
  }
});
