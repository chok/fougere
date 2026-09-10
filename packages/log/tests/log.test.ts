/**
 * A line is an announced fact, and a destination is a handler that accepts it.
 *
 * What this replaces is `onLog` — a module-level array of sinks, written three more times
 * in `adapter/sql`, `observability` and again for flushes. A destination is now declared
 * the way everything else is: by its signature. Nothing registers it, and two of them
 * both receive.
 *
 * The console is NOT one of them: `Logger` writes there whoever else took the line, so a
 * destination is for sending a line somewhere else — here, a file.
 */
import { scanProject } from '@fougere/compiler';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { join } from 'node:path';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createContainer } from '@fougere/container';
import { createApp, createLocalRunner, frond, Invocation, setLogLevel, type Logger } from '@fougere/core';
import { logFrond } from '../src/index.js';

const here = import.meta.dirname;

/** Stated, the way a consumer takes it on — beside an app that scans its own fronds. */
const app = (path: string) => createApp({
  fronds: [logFrond(path)],
  scan: () => scanProject(join(here, 'fixtures-app')),
  createContainer,
});

/** Dispatch is not delivery: the writer returns before a destination finishes. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 60));
const audited = () =>
  ((globalThis as Record<string, unknown>).__audited ?? []) as { message: string; at: Date }[];

const lines = (path: string) => (existsSync(path) ? readFileSync(path, 'utf8').trim().split('\n') : [])
  .filter(Boolean)
  .map((line) => JSON.parse(line) as { level: string; name: string; message: string; at: string });

const said = (path: string) => lines(path).map((line) => line.message);
const somewhere = () => join(mkdtempSync(join(tmpdir(), 'fougere-log-')), 'lines.jsonl');

let file = '';

describe('a line the frond announces', () => {
  beforeEach(() => {
    (globalThis as Record<string, unknown>).__audited = [];
    file = somewhere();
  });

  it('reaches the file, one JSON object per line', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    await using built = await app(file);

    await createLocalRunner(built)({ entity: 'order', op: 'create' }, { ...Invocation.empty, params: { id: '7' } });
    await settle();

    expect(said(file)).toContain('order 7 created');
    vi.restoreAllMocks();
  });

  it('separates the two doors: the shortcut prints, the raw one does not', async () => {
    const printed = vi.spyOn(console, 'info').mockImplementation(() => {});
    await using built = await app(file);

    // `OrderHandler` announces through `Emit<LogLine>`: the destination has it and the
    // console does not, because nothing asked for the console.
    await createLocalRunner(built)({ entity: 'order', op: 'create' }, { ...Invocation.empty, params: { id: '1' } });
    // `Logger` is the shortcut, and printing is part of what it IS — skipping the console
    // once a destination existed made a devtools ring silence the operator's terminal:
    // 306 per-operation lines in `demos/observability` became 2.
    built.container.resolve<Logger>('Logger').info('through the shortcut');
    await settle();

    expect(said(file)).toContain('order 1 created');
    expect(printed.mock.calls.flat().join(' ')).not.toContain('order 1 created');

    expect(said(file)).toContain('through the shortcut');
    expect(printed.mock.calls.flat().join(' ')).toContain('through the shortcut');
    vi.restoreAllMocks();
  });

  it('reaches a second destination too — a diamond is legal', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    await using built = await app(file);

    await createLocalRunner(built)({ entity: 'order', op: 'create' }, { ...Invocation.empty, params: { id: '9' } });
    await settle();

    // Declared nowhere: `AuditHandler.record` accepts `Fact<LogLine>`, and that IS the
    // subscription. `addTransport` is the call this shape does not need.
    expect(audited().map((line) => line.message)).toContain('order 9 created');
    expect(said(file)).toContain('order 9 created');
    vi.restoreAllMocks();
  });

  it('hands over the lines the boot wrote before any destination existed', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    await using built = await app(file);
    void built;
    await settle();

    // The boot writes most of what a process ever logs, and it writes it before an
    // emission exists. Held, then handed over — without this they were the only lines a
    // destination never saw.
    expect(lines(file).some((line) => /^read \d+ frond/.test(line.message))).toBe(true);
    vi.restoreAllMocks();
  });

  it('stamps `at` on announcement, because the entity says the system writes it', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    await using built = await app(file);

    // `OrderHandler` writes `level`, `name`, `message` and nothing else — `at: created()`
    // is realized by the announcement, which is what makes `Emit<T>` partial.
    await createLocalRunner(built)({ entity: 'order', op: 'create' }, { ...Invocation.empty, params: { id: '3' } });
    await settle();

    expect(audited()[0]?.at).toBeInstanceOf(Date);
    vi.restoreAllMocks();
  });

  it('gives two apps in one process their own destination', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const second = somewhere();
    await using first = await app(file);
    await using other = await app(second);

    await createLocalRunner(first)({ entity: 'order', op: 'create' }, { ...Invocation.empty, params: { id: 'a' } });
    await createLocalRunner(other)({ entity: 'order', op: 'create' }, { ...Invocation.empty, params: { id: 'b' } });
    await settle();

    // A hold kept per PROCESS sent the second app's lines to the first app's door, and
    // only the first of three printed — measured on `demos/observability`.
    expect(said(file)).toContain('order a created');
    expect(said(file)).not.toContain('order b created');
    expect(said(second)).toContain('order b created');
    vi.restoreAllMocks();
  });

  it('refuses a line that is not one, and the writer keeps going', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const refused = vi.spyOn(console, 'error').mockImplementation(() => {});
    await using built = await app(file);

    // A fact is validated strictly, and announcing is DISPATCH: the refusal is reported,
    // never handed back to the writer. `onLog` handed a sink whatever the writer passed,
    // so a collector downstream discovered the shape in another process.
    await built.container.resolve<(line: unknown) => Promise<void>>('logLineEmit')(
      { level: 'chatty', name: 'shop', message: 'x', args: [] },
    );
    await settle();

    expect(said(file)).not.toContain('x');
    expect(refused.mock.calls.flat().join(' ')).toMatch(/level/);
    vi.restoreAllMocks();
  });

  it('stamps a line for a destination that declares no entity', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const collected: { at?: Date }[] = [];

    class Only {
      async record(line: { at?: Date }): Promise<void> { collected.push(line); }
    }

    // The line is core's, so its SHAPE is core's: a destination brought by an extension
    // declares a handler and nothing else, and without the shape `at: created()` was never
    // stamped — the handler was handed `undefined` and threw.
    await using built = await createApp({
      fronds: [frond('shop', {})],
      createContainer,
      extensions: [{
        name: 'only',
        fronds: [frond('only', {
          handlers: [{
            ctor: Only,
            deps: [],
            operations: {
              record: {
                binding: [{ name: 'line', optional: false, source: { kind: 'fact', factName: 'logLine' } }],
              },
            },
          }],
        })],
      }],
    });

    built.container.resolve<Logger>('Logger').info('stamped by the announcement');
    await settle();

    expect(collected.every((line) => line.at instanceof Date)).toBe(true);
    expect(collected.length).toBeGreaterThan(0);
    vi.restoreAllMocks();
  });

  it('says a boot line ONCE, whether or not a destination took it', async () => {
    const printed = vi.spyOn(console, 'debug').mockImplementation(() => {});
    setLogLevel('debug');

    // The console is never skipped, so the hold must not print on the way out. It did,
    // and every boot line of an app with no destination was said twice.
    await expect(createApp({ createContainer })).rejects.toThrow();

    const once = printed.mock.calls.filter((call) => call.join(' ').includes('builtins registered'));
    expect(once).toHaveLength(1);
    setLogLevel('info');
    vi.restoreAllMocks();
  });
});
