import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

export default defineConfig({
  plugins: [
    swc.vite({
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: { decoratorVersion: '2023-11' },
        target: 'es2022',
      },
    }),
  ],
  oxc: false,
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
