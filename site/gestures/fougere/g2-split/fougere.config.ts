import type { FougereConfig } from '@fougere/core';

export default {
  db: { dialect: 'sqlite', path: '.data/app.db' },
  fronds: { blog: { remote: 'http://127.0.0.1:4701' } },
} satisfies FougereConfig;
