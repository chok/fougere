/**
 * La Frond blog, seule dans son process — le gradient vécu.
 *
 * Mêmes fronds/** que l'app Nuxt : seul le runtime déménage. L'app Nuxt
 * déclare `remotes: { blog: 'http://127.0.0.1:4100' }` et ne change rien d'autre.
 */
import { createJiti } from 'jiti';
import { createApp, createLocalRunner, setModuleLoader, Logger } from '@fougere/core';
import { createContainer } from '@fougere/container-fougere';
import { setupSqlite, autoMigrate } from '@fougere/schema-drizzle';
import { serve } from '@fougere/transport-http';

const jiti = createJiti(import.meta.url, { interopDefault: true });
setModuleLoader((filePath) => jiti.import(filePath));

const log = new Logger('blog-host');
const { ormFactory, sqlite } = setupSqlite({ path: './nuxt-blog.db' });

const app = await createApp({ root: process.cwd(), createContainer, ormFactory, fronds: ['blog'] });
autoMigrate({ fronds: app.fronds }, sqlite);

const { port } = await serve(createLocalRunner(app), { port: Number(process.env.PORT ?? 4100) });
log.info(`frond blog servie — POST http://127.0.0.1:${port}/_fougere/call`);
