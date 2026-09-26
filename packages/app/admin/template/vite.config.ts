import { defineConfig } from 'vite';
import { fougere } from '@fougere/vite';
import react from '@vitejs/plugin-react';

/**
 * The admin reads the identity card at `/_fougere/call`, and `fougere()` answers there: the dev
 * server boots the app from `fougere.config.ts`, so `fronds:` decides whether a frond answers in
 * this process or a process away.
 */
export default defineConfig({
  // Fronds are shared at the workspace root, two levels up from apps/<name>.
  plugins: [fougere({ root: '../..' }), react()],
});
