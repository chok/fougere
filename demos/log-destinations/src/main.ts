/**
 * Where a line goes is the operator's line, not the domain's.
 *
 *   OrderHandler ── Emit<LogLine> ──▶ ConsoleHandler   (@fougere/log, shipped)
 *                                  └▶ KeepHandler      (this project, kept in memory)
 *
 * `OrderHandler` names neither. Take `logFrond()` out of the list below and nothing
 * prints — there is no logger to configure, and no level to set to silent.
 *
 *   pnpm dev
 */
import { createApp, createLocalRunner, Invocation } from '@fougere/core';
import { scanProject, frondAliases } from '@fougere/compiler';
import { setModuleLoader } from '@fougere/core/node';
import { createContainer } from '@fougere/container';
import { logFrond } from '@fougere/log';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createJiti } from 'jiti';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { interopDefault: true, alias: await frondAliases(root) });
setModuleLoader((filePath) => jiti.import(filePath) as Promise<Record<string, unknown>>);

/** Rows in a Map: this demo is about where a LINE goes, not where a row lives. */
const rows = new Map<string, Record<string, unknown>>();
const storageFactory = () => ({
  async list() { return [...rows.values()]; },
  async findById(id: string) { return rows.get(id); },
  async create(input: Record<string, unknown>) {
    const row = { ...input, id: input.id ?? `o${rows.size + 1}` };
    rows.set(String(row.id), row);
    return row;
  },
  async update() { throw new Error('not exercised'); },
  async delete() { return false; },
  output() { return this; },
}) as never;

// The whole statement about logging: the frond is taken on, or it is not.
/** Where the file destination writes. A real app names a path it keeps. */
const lines = join(mkdtempSync(join(tmpdir(), 'fougere-log-')), 'lines.jsonl');

const app = await createApp({
  fronds: [logFrond(lines)],
  scan: await scanProject(root),
  createContainer,
  storageFactory,
});

const run = createLocalRunner(app);
for (const sku of ['fern', 'moss', 'ivy']) {
  await run({ entity: 'order', op: 'create' }, { ...Invocation.empty, input: { sku, cents: 1200 } });
}

// Dispatch is not delivery: the writer returned before the destinations finished.
await new Promise((resolve) => setTimeout(resolve, 50));

const kept = await run({ entity: 'keep', op: 'list' }, Invocation.empty) as string[];
console.log(`
  Logger printed the three lines above, and it always does — a destination is an addition.
  The same lines reached TWO of them, each declared by its signature alone: a file
  (@fougere/log) and KeepHandler, in this project.

${kept.map((line) => `    ${line}`).join('\n')}

  ${lines}

  Take logFrond(lines) out of the list in src/main.ts: the file stops, KeepHandler keeps,
  and the console is unchanged.
`);

await app.dispose();
