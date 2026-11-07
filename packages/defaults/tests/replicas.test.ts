/**
 * Replicas of one app booting together on one database, as real processes: what a boot writes,
 * it writes once, whichever replica gets there first.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createContainer } from '@fougere/container';
import { createSqliteSource } from '@fougere/adapter-sql';
import { createApp, migrating, Page } from '@fougere/core';
import { layerOf, storageFrom } from '../src/storage/ResolvedStorage.js';
import { notes, SEEDED } from './fixtures-replicas/notes.js';

const replica = join(import.meta.dirname, 'fixtures-replicas', 'replica.ts');
const REPLICAS = 4;
const ROUNDS = 5;
const noSeeds = { name: 'seeds', up: async () => {} };

const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

async function migratedDatabase(): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), 'replicas-'));
  dirs.push(dir);
  const path = join(dir, 'app.db');
  const storage = storageFrom({ main: { source: createSqliteSource({ path }) } });

  await (await createApp({
    createContainer,
    ...layerOf(storage),
    extensions: [migrating(storage.migrate), noSeeds],
    fronds: [notes],
  } as never)).dispose();
  await storage.close?.();

  return path;
}

function started(path: string): Promise<ChildProcess> {
  const child = spawn(process.execPath, [replica, path], {
    stdio: ['pipe', 'pipe', 'inherit'],
    env: { ...process.env, FOUGERE_LOG_LEVEL: 'warn' },
  });

  return new Promise((resolve, reject) => {
    child.stdout!.once('data', (line) => String(line).startsWith('READY') ? resolve(child) : reject(new Error(String(line))));
    child.once('exit', (code) => reject(new Error(`replica exited before it was ready (code ${code})`)));
  });
}

function outcomeOf(child: ChildProcess): Promise<string> {
  let out = '';
  child.stdout!.on('data', (chunk) => { out += chunk; });

  return new Promise((resolve) => child.once('exit', () => resolve(out.trim())));
}

async function bootTogether(path: string): Promise<string[]> {
  const children = await Promise.all(Array.from({ length: REPLICAS }, () => started(path)));
  const outcomes = children.map(outcomeOf);
  for (const child of children) child.stdin!.write('go\n');

  return Promise.all(outcomes);
}

async function titlesIn(path: string): Promise<string[]> {
  const storage = storageFrom({ main: { source: createSqliteSource({ path }) } });
  await using app = await createApp({ createContainer, ...layerOf(storage), extensions: [noSeeds], fronds: [notes] } as never);
  const rows = Page.of(await app.storageFor('note')!.list({ limit: 1000 })).items;
  await storage.close?.();

  return rows.map((row) => row.title as string).sort();
}

describe.skip(`${REPLICAS} replicas booting together on one SQLite file`, () => {
  it.each(Array.from({ length: ROUNDS }, (_, round) => round + 1))('plant the seeds once — round %i', async () => {
    const path = await migratedDatabase();

    const outcomes = await bootTogether(path);

    expect(outcomes).toEqual(Array(REPLICAS).fill('BOOTED'));
    expect(await titlesIn(path)).toEqual([...SEEDED].sort());
  }, 30_000);
});
