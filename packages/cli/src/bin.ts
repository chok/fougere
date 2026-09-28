#!/usr/bin/env node
/** `--version` answers before anything loads; every other command boots the CLI's app. */
import { version } from './version.js';

const [first] = process.argv.slice(2);
if (first === '--version' || first === '-v') {
  console.log(version());
} else {
  await import('./main.js');
}
