/**
 * The gradient proof — path-2026, dérogation 2026-07-17.
 *
 * Same fronds/**, twice: locally (control app) and moved to a child process
 * behind /_fougere/call. The same user code — resolve('productHandler').op() —
 * must give the same results, errors included. Criteria 4 and 5 of the path.
 */
import { scanProject } from '@fougere/core/node';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';
import { createApp, createLocalRunner, FougereError, EMPTY_INVOCATION, ErrorCode } from '@fougere/core';
import type { App, InvocationContext, Transport } from '@fougere/core';
import { createContainer } from '@fougere/container';
import { createHttpTransport } from '../src/index.js';
// @ts-expect-error plain-JS shared fixture
import { createStorageFactory, PRODUCTS } from './fixtures/data.mjs';

const fixturesDir = join(import.meta.dirname, 'fixtures');
const emptyRoot = '/tmp/fougere-gradient-consumer';

type Facade = Record<string, (invocation?: InvocationContext) => Promise<unknown>>;

const inv = (over: Partial<InvocationContext> = {}): InvocationContext =>
  ({ params: {}, query: {}, body: undefined, state: {}, ...over });

function startHost(): Promise<{ child: ChildProcess; port: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(fixturesDir, 'host.mjs')], { stdio: ['ignore', 'pipe', 'pipe'] });
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
let localRun: Transport;
let consumer: App;
let facade: Facade;

beforeAll(async () => {
  ({ child, port } = await startHost());
  control = await createApp({ scan: await scanProject(fixturesDir), createContainer, storageFactory: createStorageFactory() });
  localRun = createLocalRunner(control);
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
      const { code, message, entity, operation, details } = err;
      return { failed: { code, message, entity, operation, details } };
    }
    throw err;
  }
}

describe('gradient — the moved Frond behaves identically', () => {
  const cases: [string, string, InvocationContext][] = [
    ['list', 'list', inv()],
    ['findById (hit)', 'findById', inv({ params: { id: 'p1' } })],
    ['findById (miss)', 'findById', inv({ params: { id: 'ghost' } })],
    ['create (valid)', 'create', inv({ body: { title: 'Ivy', stock: 5 } })],
    ['create (invalid — judged where the handler lives)', 'create', inv({ body: { stock: -2 } })],
    ['reserve (business failure)', 'reserve', inv()],
  ];

  it.each(cases)('parity on %s', async (_label, op, invocation) => {
    const local = await outcomeOf(() => localRun({ entity: 'product', op }, invocation));
    const remote = await outcomeOf(() => facade[op](invocation));
    expect(remote).toEqual(JSON.parse(JSON.stringify(local)));
  }, 15_000);

  it('sanity: the dataset actually crossed', async () => {
    expect(await facade.list()).toEqual(PRODUCTS);
  });

  it('the validation judgment happens handler-side and crosses typed', async () => {
    const failure = facade.create(inv({ body: { stock: -2 } }));
    await expect(failure).rejects.toBeInstanceOf(FougereError);
    await expect(failure).rejects.toMatchObject({ code: ErrorCode.VALIDATION_FAILED, entity: 'product' });
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
