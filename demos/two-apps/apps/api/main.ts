import { createAppRunner } from '@fougere/core';
import { serve } from '@fougere/transport-http';
import { bootApi } from './boot.js';

const app = await bootApi();
const { port } = await serve(createAppRunner(app), { port: 4700 });
console.log(`  api answers on http://127.0.0.1:${port}/_fougere/call`);
