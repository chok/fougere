import { defineConfig } from 'vite';
import { fougere } from '@fougere/vite';
import react from '@vitejs/plugin-react';

/**
 * `fougere()` states the two things any Vite-built host must know: the packages a boot loads
 * at runtime, and a minifier that keeps class names — designation reads a class's `name`, and
 * a renamed one designates an entity nobody hosts. It also writes `@fronds/facade`.
 */
export default defineConfig({
  // Fronds are shared at the workspace root, two levels up from apps/<name>.
  root: '.',
  plugins: [fougere(), react()],
});
