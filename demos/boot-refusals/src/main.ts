/**
 * Every refusal the boot can answer, one case each — and what each one names.
 *
 * A refusal used to be a string: it said what was wrong and, 42 times out of 47, not WHERE.
 * Each case below is a project that does not hold, booted for its answer — a `Diagnostic`
 * carrying a stable code, the subject, and the file to open. The last one breaks three rules
 * at once, which is the whole reason they are collected rather than thrown one at a time.
 */
import { boot } from '@fougere/compiler';
import { createContainer } from '@fougere/container';
import type { Storage } from '@fougere/core';
import { join } from 'node:path';

const here = join(import.meta.dirname, '..', 'cases');

/** Rows in a Map — no case here gets far enough to write one. */
const storageFactory = (() => {
  const rows: Record<string, unknown>[] = [];
  const storage = {
    async list() { return { items: [...rows], total: rows.length }; },
    async findById() { return undefined; },
    async findBy() { return undefined; },
    async findAllBy() { return []; },
    async findByKeys() { return new Map(); },
    async findAllByKeys() { return new Map(); },
    async create(input: Record<string, unknown>) { rows.push(input); return input; },
    async upsert(input: Record<string, unknown>) { return input; },
    async upsertAll() { return 0; },
    async update(_id: string, input: Record<string, unknown>) { return input; },
    async delete() { return true; },
    output() { return storage; },
    client: {},
  };

  return storage;
}) as unknown as () => Storage;

interface Case {
  /** The directory under `cases/`, and the code the boot is expected to answer. */
  name: string;
  /** What the project states that does not hold. */
  states: string;
  ports?: Record<string, string | readonly string[]>;
}

const CASES: Case[] = [
  { name: 'provider-name-taken', states: 'services/Pricing.ts and repositories/Pricing.ts both declare Pricing' },
  { name: 'port-implemented-twice', states: 'StripePayment and OgonePayment both extend Payment' },
  { name: 'port-wrapped-twice', states: 'RetryingPayment and LoggingPayment both wrap Payment' },
  { name: 'port-not-extended', states: "ports: { Payment: 'Absent' } names a class nothing declares", ports: { Payment: 'Absent' } },
  { name: 'seam-not-wrapped', states: 'Audited extends Storage without asking for one' },
  { name: 'entity-owned-twice', states: 'CatalogRepository and StockRepository both own item' },
  { name: 'aggregate-storage-reached', states: 'LineHandler asks for LineStorage, which CatalogRepository owns' },
  { name: 'storage-outside-repository', states: 'ItemHandler asks for ItemStorage instead of ItemRepository' },
  { name: 'crud-on-owned-entity', states: 'LineHandler takes the five gestures on an owned entity' },
  { name: 'storage-key-is-provider', states: "services/ItemStorage.ts takes item's own container key" },
  { name: 'frond-key-taken', states: "fronds 'shop' and 'stock' both answer at itemHandler" },
  { name: 'several-at-once', states: 'three of the rules above, in one project' },
];

let refused = 0;
for (const one of CASES) {
  console.log(`\n── ${one.name}`);
  console.log(`   ${one.states}`);
  try {
    const app = await boot({
      root: join(here, one.name),
      createContainer,
      db: () => ({ storageFactory }),
      ...(one.ports ? { config: { ports: one.ports } } : {}),
    });
    await app.dispose();
    console.log('   → booted. Nothing was refused, which is the bug this case exists to catch.');
  } catch (err) {
    refused += 1;
    console.log((err as Error).message.split('\n').map((line) => `   ${line}`).join('\n'));
  }
}

console.log(`\n${refused} of ${CASES.length} refused.`);
