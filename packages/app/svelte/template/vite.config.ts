import { defineConfig } from 'vite';
import { fougere } from '@fougere/vite';
import { sveltekit } from '@sveltejs/kit/vite';

/**
 * The same `fougere()` the React and TanStack starters use — it knows nothing about which
 * host renders. It states the packages a boot loads at runtime, keeps class names through
 * minification, and writes `@fronds/facade`.
 */
export default defineConfig({
  plugins: [fougere(), sveltekit()],
});
