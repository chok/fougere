import { ORMError, ORMErrorReason, ZenStackClient } from '@zenstackhq/orm';
import { SqliteDialect } from '@zenstackhq/orm/dialects/sqlite';
import SQLite from 'better-sqlite3';
import { schema } from '../zenstack/schema.ts';

export const db = new ZenStackClient(schema, {
  dialect: new SqliteDialect({ database: new SQLite('./zenstack/dev.db') }),
  procedures: {
    publishPost: async ({ client, args }) => {
      const post = await client.post.findUniqueOrThrow({ where: { id: args.id } });
      if (post.publishedAt) throw new ORMError(ORMErrorReason.INVALID_INPUT, 'Already published');

      return client.post.update({ where: { id: args.id }, data: { publishedAt: new Date() } });
    },
  },
});
