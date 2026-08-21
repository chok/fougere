import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // Playwright démarre le serveur lui-même : rien à lancer à côté, et le port est celui
  // que le serveur annonce.
  webServer: {
    command: 'pnpm exec tsx server.ts',
    url: 'http://127.0.0.1:4300',
    reuseExistingServer: !process.env.CI,
  },
  use: { baseURL: 'http://127.0.0.1:4300' },
});
