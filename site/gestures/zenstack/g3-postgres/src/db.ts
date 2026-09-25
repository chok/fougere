import { ORMError, ORMErrorReason, ZenStackClient } from '@zenstackhq/orm';
import { PostgresDialect } from '@zenstackhq/orm/dialects/postgres';
import { Pool } from 'pg';
import { schema } from '../zenstack/schema.ts';

export const db = new ZenStackClient(schema, {
  dialect: new PostgresDialect({ pool: new Pool({ connectionString: process.env.DATABASE_URL }) }),
  procedures: {
    publishPost: async ({ client, args }) => {
      const post = await client.post.findUniqueOrThrow({ where: { id: args.id } });
      if (post.publishedAt) throw new ORMError(ORMErrorReason.INVALID_INPUT, 'Already published');

      return client.post.update({ where: { id: args.id }, data: { publishedAt: new Date() } });
    },
  },
});
