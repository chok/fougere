import '@fougere/adapter-sql';
import type { FougereConfig } from '@fougere/core';

export default {
  sources: { main: { type: 'sqlite', path: '.data/app.db' } },
  fronds: { '@fougere/log': {} },
} satisfies FougereConfig;
