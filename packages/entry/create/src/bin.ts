#!/usr/bin/env node
/** `npm create fougere` / `pnpm create fougere` — the CLI, entered at `new`. */
process.argv.splice(2, 0, 'new');

await import('@fougere/cli/bin');
