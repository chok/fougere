/**
 * One link, in its own process — `pnpm link:tenant`, `pnpm link:privacy`.
 *
 * The handler file is the same one that runs in-process when `pnpm dev` scans everything.
 * A link does not know it is second: the order is applied where the fact is announced.
 */
import { createApp, createLocalRunner } from '@fougere/core';
import { scanProject, frondAliases } from '@fougere/compiler';
import { setModuleLoader } from '@fougere/core/node';
import { createContainer } from '@fougere/container';
import { serve } from '@fougere/transport-http';
import { createJiti } from 'jiti';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { interopDefault: true, alias: await frondAliases(root) });
setModuleLoader((filePath) => jiti.import(filePath) as Promise<Record<string, unknown>>);

const [name, port] = process.argv.slice(2);
// Its own frond and nothing else. The ORDER is read where the fact is ANNOUNCED, so a
// link needs neither it nor the entity — and hosting `blog` here would make two processes
// claim to serve it.
const app = await createApp({ scan: await scanProject(root, [name!]), createContainer });
const receiver = await serve(createLocalRunner(app), { port: Number(port) });

console.log(`\n  ${name} on :${port} — one link, alone in its process\n`);
process.on('SIGINT', async () => { await receiver.close(); await app.dispose(); process.exit(0); });
