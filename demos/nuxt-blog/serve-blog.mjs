/**
 * La Frond blog, seule dans son process — le gradient vécu.
 *
 * Mêmes fronds/** que l'app Nuxt : seul le runtime déménage. L'app Nuxt
 * déclare `remotes: { blog: 'http://127.0.0.1:4100' }` et ne change rien d'autre.
 */
import { createJiti } from 'jiti';
import { createApp, createLocalRunner, setModuleLoader, frondAliases, Logger } from '@fougere/core';
import { createContainer } from '@fougere/container';
import { setupSqlite, migrate } from '@fougere/schema-sql';
import { serve } from '@fougere/transport-http';

// `frondAliases` is what makes `@frond/user/entities/User.js` resolve — the named
// form a frond uses for its neighbour. Without it this entry point loaded frond
// sources through a bare jiti, and `CurrentUserCollector` died on that import
// while the very same code worked in-process under Nuxt.
const jiti = createJiti(import.meta.url, {
  interopDefault: true,
  alias: await frondAliases(process.cwd()),
});
setModuleLoader((filePath) => jiti.import(filePath));

const log = new Logger('blog-host');
const { ormFactory, db } = setupSqlite({ path: './nuxt-blog.db' });

const app = await createApp({ root: process.cwd(), createContainer, ormFactory, fronds: ['blog'] });
await migrate({ fronds: app.fronds }, db);

const { port } = await serve(createLocalRunner(app), { port: Number(process.env.PORT ?? 4100) });
log.info(`frond blog servie — POST http://127.0.0.1:${port}/_fougere/call`);
