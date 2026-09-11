/**
 * Host process — the Frond moved out. Boots the same fronds/** as the control
 * app and serves them behind /_fougere/call. Announces its port on stdout.
 */
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createJiti } from 'jiti';
import { createApp, createLocalRunner } from '@fougere/core';
import { scanProject } from '@fougere/compiler';
import { setModuleLoader } from '@fougere/core/node';
import { createContainer } from '@fougere/container';
import { serve } from '../../dist/index.js';
// `./data.ts`, not `./data.js`: this file is spawned with `node host.ts` and Node
// resolves what is on disk. The tests beside it run under vitest and keep `.js`.
import { createStorageFactory } from './data.ts';

const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { interopDefault: true });
setModuleLoader((filePath: string) => jiti.import(filePath) as Promise<Record<string, unknown>>);

const app = await createApp({ scan: await scanProject(here), createContainer, storageFactory: createStorageFactory() });
const receiver = await serve(createLocalRunner(app), { port: 0 });
console.log(`FOUGERE_PORT=${receiver.port}`);
