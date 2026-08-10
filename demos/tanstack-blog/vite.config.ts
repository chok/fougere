import { defineConfig } from 'vite';
import { fougere } from '@fougere/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';

/**
 * `fougere()` states the two things any Vite-built host must know: the packages a
 * boot loads at runtime, and a minifier that keeps class names — designation reads
 * `Post.name`, and a renamed class designates an entity nobody hosts.
 *
 * The same plugin serves the React Router and SvelteKit demos. None of the three
 * needs an adapter package.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [fougere(), tanstackStart(), viteReact()],
});
