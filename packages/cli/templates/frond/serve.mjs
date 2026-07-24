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
import { createLocalRunner, setModuleLoader, Logger } from '@fougere/core';
import { bootAppFromConfig } from '@fougere/runtime';
import { serve } from '@fougere/transport-http';

const jiti = createJiti(import.meta.url, { interopDefault: true });
setModuleLoader((filePath) => jiti.import(filePath));

const log = new Logger('frond-host');

// `topology: false` — this process *is* the frond, it doesn't route back out.
// Storage comes from fougere.config.ts; this host names no engine.
const app = await bootAppFromConfig(process.cwd(), { topology: false });

const { port } = await serve(createLocalRunner(app), { port: Number(process.env.PORT ?? 4000) });
log.info(`frond served — POST http://127.0.0.1:${port}/_fougere/call`);
