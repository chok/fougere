#!/usr/bin/env node
/** `--version` answers before anything loads; every other command boots the CLI's app. */
import { readFileSync } from 'node:fs';

const [first] = process.argv.slice(2);
if (first === '--version' || first === '-v') {
  console.log((JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string }).version);
} else {
  await import('./main.js');
}
