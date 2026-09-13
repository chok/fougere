import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * No `@fougere/vite` here: this app scans nothing and boots nothing. It is a reader of one
 * endpoint, and the only thing it needs is a way to reach it without crossing an origin.
 *
 * Point the proxy at whichever app serves your frond. In production the two are usually
 * behind one host, and this block goes away.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/_fougere': 'http://localhost:3000' },
  },
});
