import { createInterface } from 'node:readline';
import { createContainer } from '@fougere/container';
import { createSqliteSource } from '@fougere/adapter-sql';
import { createApp } from '@fougere/core';
import { layerOf, storageFrom } from '../../dist/index.js';
import { notes } from './notes.ts';

const storage = storageFrom({ main: { source: createSqliteSource({ path: process.argv[2] }) } });
console.log('READY');

await new Promise((go) => createInterface({ input: process.stdin }).once('line', go));

try {
  const app = await createApp({ createContainer, ...layerOf(storage), fronds: [notes] } as never);
  await app.dispose();
  console.log('BOOTED');
} catch (refusal) {
  console.log(`REFUSED ${(refusal as Error).message.split('\n')[0]}`);
}
await storage.close?.();
process.exit(0);
