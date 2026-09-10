/**
 * One responder, alone in its process. `pnpm rooms`, `pnpm billing`, `pnpm calendar`.
 *
 * The handler file is the same one that runs in-process when `pnpm dev` scans everything:
 * what changes is which fronds this app hosts, and that is stated here, not in the frond.
 */
import { createApp, createLocalRunner } from '@fougere/core';
import { scanProject, frondAliases } from '@fougere/compiler';
import { setModuleLoader } from '@fougere/core/node';
import { createContainer } from '@fougere/container';
import { serve } from '@fougere/transport-http';
import { createJiti } from 'jiti';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const [name, port] = process.argv.slice(2);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { interopDefault: true, alias: await frondAliases(root) });
setModuleLoader((filePath) => jiti.import(filePath) as Promise<Record<string, unknown>>);

// Its own frond and nothing else. The subject's entity is a TYPE here — erased at
// runtime — so hosting `booking` too would make three processes claim to serve it.
const app = await createApp({ scan: await scanProject(root, [name!]), createContainer });
const receiver = await serve(createLocalRunner(app), { port: Number(port) });

console.log(`  ${name} on :${port} — it answers, and knows nobody who asks`);
process.on('SIGINT', async () => { await receiver.close(); await app.dispose(); process.exit(0); });
