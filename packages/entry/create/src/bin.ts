#!/usr/bin/env node
/** `npm create fougere` — or pnpm, bun, yarn: the CLI, entered at `new`. */
process.argv.splice(2, 0, 'new');

await import('@fougere/cli/bin');
