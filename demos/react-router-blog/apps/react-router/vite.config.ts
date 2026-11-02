import { reactRouter } from '@react-router/dev/vite';
import { defineConfig } from 'vite';
import { fougere } from '@fougere/vite';

export default defineConfig({
  plugins: [fougere(), reactRouter()],
  resolve: { tsconfigPaths: true },
});
