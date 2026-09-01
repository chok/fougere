/**
 * The DDL, derived and printed — because APPLYING it belongs to the platform.
 *
 * D1 has no connection to open and no migration runner Fougere could drive: schema
 * changes go through `wrangler d1 execute`. So this prints what the entities say the
 * tables are, and wrangler puts it there. The derivation is still single-source — the
 * same `generateSQL` every other engine's `autoMigrate` writes through.
 *
 *   pnpm schema && wrangler d1 execute fougere-catalog --local --file .fougere/schema.sql
 *
 * A FILE and not stdout: the boot writes its own lines there, and a pipe carrying both
 * the log and the DDL is a schema that fails at the driver on line one.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { createApp } from '@fougere/core';
import { scanProject, setModuleLoader, frondAliases } from '@fougere/core/node';
import { createContainer } from '@fougere/container';
import { generateSQL } from '@fougere/adapter-sql';
import { createJiti } from 'jiti';

const root = new URL('..', import.meta.url).pathname;
const jiti = createJiti(import.meta.url, { interopDefault: true, alias: await frondAliases(root) });
setModuleLoader((filePath) => jiti.import(filePath));

// No storage: generating DDL reads the entities and nothing else, so the app never
// needs a connection. `storageFactory` is required, and a handler is never called here.
const app = await createApp({
  scan: await scanProject(root),
  createContainer,
  storageFactory: () => ({}),
});

const sql = generateSQL(app, { dialect: 'sqlite' }).map((statement) => `${statement};`).join('\n');
const out = new URL('../.fougere/schema.sql', import.meta.url).pathname;
await mkdir(new URL('../.fougere/', import.meta.url).pathname, { recursive: true });
await writeFile(out, `${sql}\n`);
console.log(`\n  .fougere/schema.sql — ${generateSQL(app, { dialect: 'sqlite' }).length} statement(s), derived from the entities\n`);
