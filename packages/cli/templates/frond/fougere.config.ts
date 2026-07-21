import type { FougereConfig } from '@fougere/core';

export default {
  db: { dialect: 'sqlite', path: '.data/app.db' },
} satisfies FougereConfig;
