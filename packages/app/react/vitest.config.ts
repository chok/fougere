import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    // Hooks need somewhere to mount. The Svelte package needs none of this — its
    // stores are plain JavaScript — and that difference is React's, not ours.
    environment: 'jsdom',
  },
});
