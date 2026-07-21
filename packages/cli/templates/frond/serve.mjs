/**
 * This frond, alone in its own process — the gradient's third freedom.
 *
 * An app in another repo consumes it with one line:
 *   remotes: { <frond>: 'http://127.0.0.1:4000' }
 * and pulls its contract with:
 *   fougere sync <frond> --from http://127.0.0.1:4000
 * Nothing in the frond changes — only where it runs.
 */
import { createJiti } from 'jiti';
import { createApp, createLocalRunner, setModuleLoader, Logger } from '@fougere/core';
import { createContainer } from '@fougere/container-fougere';
import { setupSqlite, autoMigrate } from '@fougere/schema-drizzle';
import { serve } from '@fougere/transport-http';

const jiti = createJiti(import.meta.url, { interopDefault: true });
setModuleLoader((filePath) => jiti.import(filePath));

const log = new Logger('frond-host');
const { ormFactory, sqlite } = setupSqlite({ path: '.data/app.db' });

const app = await createApp({ root: process.cwd(), createContainer, ormFactory });
autoMigrate({ fronds: app.fronds }, sqlite);

const { port } = await serve(createLocalRunner(app), { port: Number(process.env.PORT ?? 4000) });
log.info(`frond served — POST http://127.0.0.1:${port}/_fougere/call`);
