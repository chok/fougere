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
const app = await createApp({
  fronds: [logFrond()],
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
  the console printed the three lines above — it is a handler in @fougere/log
  the same three reached a second destination, declared by its signature alone:

${kept.map((line) => `    ${line}`).join('\n')}

  comment out \`logFrond()\` in src/main.ts: nothing prints, and KeepHandler still keeps.
`);

await app.dispose();
