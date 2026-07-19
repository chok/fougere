/**
 * Host process — the Frond moved out. Boots the same fronds/** as the control
 * app and serves them behind /_fougere/call. Announces its port on stdout.
 */
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createJiti } from 'jiti';
import { createApp, createLocalRunner, setModuleLoader } from '@fougere/core';
import { createContainer } from '@fougere/container-fougere';
import { serve } from '../../dist/index.js';
import { createOrmFactory } from './data.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { interopDefault: true });
setModuleLoader((filePath) => jiti.import(filePath));

const app = await createApp({ root: here, createContainer, ormFactory: createOrmFactory() });
const receiver = await serve(createLocalRunner(app), { port: 0 });
console.log(`FOUGERE_PORT=${receiver.port}`);
