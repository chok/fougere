/**
 * The link, in its own process. `pnpm dev:redact` — then `pnpm dev` finds it by address.
 *
 * `RedactHandler` is the same file either way. What decides is one line in `src/main.ts`.
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

const app = await createApp({ scan: await scanProject(root, ['redact', 'blog']), createContainer });
const receiver = await serve(createLocalRunner(app), { port: 4600 });

console.log('\n  redact on :4600 — the link alone in its process\n');
process.on('SIGINT', async () => { await receiver.close(); await app.dispose(); process.exit(0); });
