#!/usr/bin/env node
/**
 * `npm create fougere` / `pnpm create fougere` — the CLI, entered at `new`.
 *
 * The ecosystem spells scaffolding this way, and the spelling resolves to the
 * package named `create-<name>`. So this is the same CLI as `fougere`, with one
 * word inserted: what the user typed after the name is what `fougere new` reads.
 *
 *     pnpm create fougere shop --frond blog --app nuxt
 *          → fougere new shop --frond blog --app nuxt
 *
 * Inserting rather than replacing is what keeps the two in step: every flag
 * `New` declares works here the day it is declared, with nothing to mirror.
 */
process.argv.splice(2, 0, 'new');

await import('@fougere/cli/bin');
