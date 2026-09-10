/**
 * A line is an announced fact, and a destination is a handler that accepts it.
 *
 * What this replaces is `onLog` — a module-level array of sinks, written three more times
 * in `adapter/sql`, `observability` and again for flushes. A destination is now declared
 * the way everything else is: by its signature. Nothing registers it, and two of them
 * both receive.
 */
import { scanProject } from '@fougere/compiler';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { join } from 'node:path';
import { createContainer } from '@fougere/container';
import { createApp, createLocalRunner, Invocation } from '@fougere/core';
import { logFrond } from '../src/index.js';

const here = import.meta.dirname;

/** Stated, the way a consumer takes it on — beside an app that scans its own fronds. */
const app = () => createApp({
  fronds: [logFrond()],
  scan: () => scanProject(join(here, 'fixtures-app')),
  createContainer,
});

/** Dispatch is not delivery: the writer returns before a destination finishes. */
const settle = () => new Promise((r) => setTimeout(r, 60));
const audited = () =>
  ((globalThis as Record<string, unknown>).__audited ?? []) as { message: string; at: Date }[];

describe('a line the frond announces', () => {
  beforeEach(() => { (globalThis as Record<string, unknown>).__audited = []; });

  it('reaches the console, which writes and announces nothing', async () => {
    const printed = vi.spyOn(console, 'info').mockImplementation(() => {});
    await using built = await app();

    await createLocalRunner(built)({ entity: 'order', op: 'create' }, { ...Invocation.empty, params: { id: '7' } });
    await settle();

    // `console.info` and not `console.log`: the level picks the method, so a terminal
    // filter downstream can still tell a debug line from an info one.
    expect(printed).toHaveBeenCalled();
    expect(printed.mock.calls.flat().join(' ')).toContain('order 7 created');
    printed.mockRestore();
  });

  it('reaches a second destination too — a diamond is legal', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    await using built = await app();

    await createLocalRunner(built)({ entity: 'order', op: 'create' }, { ...Invocation.empty, params: { id: '9' } });
    await settle();

    // Declared nowhere: `AuditHandler.record` accepts `Fact<LogLine>`, and that IS the
    // subscription. `addTransport` is the call this shape does not need.
    expect(audited().map((line) => line.message)).toEqual(['order 9 created']);
    vi.restoreAllMocks();
  });

  it('stamps `at` on announcement, because the entity says the system writes it', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    await using built = await app();

    // `OrderHandler` writes `level`, `name`, `message` and nothing else — `at: created()`
    // is realized by the announcement, which is what makes `Emit<T>` partial.
    await createLocalRunner(built)({ entity: 'order', op: 'create' }, { ...Invocation.empty, params: { id: '3' } });
    await settle();

    expect(audited()[0]?.at).toBeInstanceOf(Date);
    vi.restoreAllMocks();
  });

  it('refuses a line that is not one, and the writer keeps going', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const refused = vi.spyOn(console, 'error').mockImplementation(() => {});
    await using built = await app();

    // A fact is validated strictly, and announcing is DISPATCH: the refusal is reported,
    // never handed back to the writer. `onLog` handed a sink whatever the writer passed,
    // so a collector downstream discovered the shape in another process.
    await built.container.resolve<(line: unknown) => Promise<void>>('logLineEmit')(
      { level: 'chatty', name: 'shop', message: 'x', args: [] },
    );
    await settle();

    expect(audited()).toEqual([]);
    expect(refused.mock.calls.flat().join(' ')).toMatch(/level/);
    vi.restoreAllMocks();
  });
});
