import type { FougereConfig } from '@fougere/core';

export default {
  db: { dialect: 'pg', url: process.env.DATABASE_URL },
} satisfies FougereConfig;
