import type { FougereConfig } from '@fougere/core';

export default {
  // File-backed on purpose: your data must survive dev reloads and deploys.
  // Lives under .data/ (gitignored) — the single writable-state dir.
  db: { dialect: 'sqlite', path: '.data/app.db' },
} satisfies FougereConfig;
