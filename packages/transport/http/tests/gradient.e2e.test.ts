/**
 * The gradient proof — path-2026, dérogation 2026-07-17.
 *
 * Same fronds/**, twice: locally (control app) and moved to a child process
 * behind /_fougere/call. The same user code — resolve('productHandler').op() —
 * must give the same results, errors included. Criteria 4 and 5 of the path.
 */
import { scanProject } from '@fougere/compiler';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';
import { createApp, FougereError, ErrorCode } from '@fougere/core';
import type { App } from '@fougere/core';
import { createContainer } from '@fougere/container';
import { createHttpTransport } from '../src/index.js';
import { createStorageFactory, PRODUCTS } from './fixtures/data.js';

const fixturesDir = join(import.meta.dirname, 'fixtures');
const emptyRoot = '/tmp/fougere-gradient-consumer';

type Facade = Record<string, (...args: unknown[]) => Promise<unknown>>;

function startHost(): Promise<{ child: ChildProcess; port: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(fixturesDir, 'host.ts')], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`host never announced its port. stderr:\n${err}`));
    }, 20_000);
    child.stderr!.on('data', (d) => { err += d; });
    child.stdout!.on('data', (d) => {
      out += d;
      const match = out.match(/FOUGERE_PORT=(\d+)/);
      if (match) {
        clearTimeout(timer);
        resolve({ child, port: Number(match[1]) });
      }
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`host exited early (code ${code}). stderr:\n${err}`));
    });
  });
}

let child: ChildProcess;
let port: number;
let control: App;
let local: Facade;
let consumer: App;
let facade: Facade;

beforeAll(async () => {
  ({ child, port } = await startHost());
  control = await createApp({ scan: await scanProject(fixturesDir), createContainer, storageFactory: createStorageFactory() });
  local = control.resolve<Facade>('productHandler');
  consumer = await createApp({
    scan: await scanProject(emptyRoot),
    createContainer,
    remotes: { catalog: `http://127.0.0.1:${port}` },
    remoteTransport: (url) => createHttpTransport(url, { timeoutMs: 5_000 }),
  });
  // The path's criterion 5: this is the exact line user code writes locally.
  facade = consumer.resolve<Facade>('productHandler');
}, 40_000);

afterAll(async () => {
  child?.kill('SIGKILL');
  await consumer?.dispose();
  await control?.dispose();
});

async function outcomeOf(run: () => Promise<unknown>): Promise<unknown> {
  try {
    return { ok: await run() };
  } catch (err) {
    if (err instanceof FougereError) {
      const { code, message, address, operation, details } = err;

      return { failed: { code, message, address, operation, details } };
    }
    throw err;
  }
}

describe('gradient — the moved Frond behaves identically', () => {
  const cases: [string, string, unknown[]][] = [
    ['list', 'list', []],
    ['findById (hit)', 'findById', ['p1']],
    ['findById (miss)', 'findById', ['ghost']],
    ['create (valid)', 'create', [{ title: 'Ivy', stock: 5 }]],
    ['create (invalid — validated where the handler lives)', 'create', [{ stock: -2 }]],
    ['reserve (business failure)', 'reserve', []],
  ];

  it.each(cases)('parity on %s', async (_label, op, args) => {
    const here = await outcomeOf(() => local[op](...args));
    const moved = await outcomeOf(() => facade[op](...args));
    expect(moved).toEqual(JSON.parse(JSON.stringify(here)));
  }, 15_000);

  it('sanity: the dataset actually crossed', async () => {
    expect(await facade.list()).toEqual(PRODUCTS);
  });

  it('the validation verdict happens handler-side and crosses typed', async () => {
    const failure = facade.create({ stock: -2 });
    await expect(failure).rejects.toBeInstanceOf(FougereError);
    await expect(failure).rejects.toMatchObject({ code: ErrorCode.VALIDATION_FAILED, address: 'product', operation: 'create' });
  });

  it('a business failure keeps its details across the wire', async () => {
    const failure = facade.reserve();
    await expect(failure).rejects.toMatchObject({
      code: ErrorCode.CONFLICT,
      message: 'stock déjà réservé',
      details: { reason: 'held' },
    });
  });
});

describe('gradient — the moved Frond goes down', () => {
  it('a fresh consumer fails SERVICE_UNAVAILABLE, typed, naming the remote', async () => {
    child.kill('SIGKILL');
    await new Promise<void>((resolve) => child.once('exit', () => resolve()));

    const lateConsumer = await createApp({
      scan: await scanProject(emptyRoot),
      createContainer,
      remotes: { catalog: `http://127.0.0.1:${port}` },
      remoteTransport: (url) => createHttpTransport(url, { timeoutMs: 2_000, retries: 1 }),
    });
    const lateFacade = lateConsumer.resolve<Facade>('productHandler');
    const failure = lateFacade.list();
    await expect(failure).rejects.toBeInstanceOf(FougereError);
    await expect(failure).rejects.toMatchObject({ code: ErrorCode.SERVICE_UNAVAILABLE });
    await expect(failure).rejects.toThrow(/catalog/);
    await lateConsumer.dispose();
  }, 20_000);

  it('an already-routed consumer degrades the same way', async () => {
    const failure = facade.list();
    await expect(failure).rejects.toBeInstanceOf(FougereError);
    await expect(failure).rejects.toMatchObject({ code: ErrorCode.SERVICE_UNAVAILABLE });
  }, 20_000);
});
