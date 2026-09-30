/**
 * Two lines a call, written by the process that answers it — under the frond that answers, and
 * naming the process that signed it when it came from another one.
 */
import { boot, scanProject } from '@fougere/compiler';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { join } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createContainer } from '@fougere/container';
import { createApp, createLocalRunner, frond, Invocation } from '@fougere/core';
import { log } from '../src/index.js';

const here = import.meta.dirname;

/** Every line the console printed, as the text a terminal shows. */
function printed(method: 'info' | 'error' = 'info'): string[] {
  const lines: string[] = [];
  vi.spyOn(console, method).mockImplementation((...text: unknown[]) => { lines.push(text.join(' ')); });

  return lines;
}

afterEach(() => { vi.restoreAllMocks(); });

describe('a call writes two lines', () => {
  it('says it began and what it cost, under the frond that answers', async () => {
    const lines = printed();
    await using app = await createApp({
      scan: () => scanProject(join(here, 'fixtures-app')),
      createContainer,
      extensions: [log()],
    });

    await createLocalRunner(app)({ address: 'order', op: 'create' }, { ...Invocation.empty, params: { id: '7' } });

    const calls = lines.filter((line) => line.includes('OrderHandler.create'));
    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain('[app:shop]');
    expect(calls[1]).toMatch(/OrderHandler\.create \(\d+\.\dms\)/);
  });

  it('names the process that signed a call from elsewhere', async () => {
    const lines = printed();
    await using app = await createApp({
      scan: () => scanProject(join(here, 'fixtures-app')),
      createContainer,
      extensions: [log()],
    });

    await createLocalRunner(app)(
      { address: 'order', op: 'create' },
      Invocation.from({ params: { id: '8' }, caller: 'catalog' }),
    );

    const calls = lines.filter((line) => line.includes('OrderHandler.create'));
    expect(calls).toHaveLength(2);
    expect(calls.every((line) => line.endsWith('← catalog'))).toBe(true);
  });

  it('writes the refusal as an error line', async () => {
    const errors = printed('error');
    class RefusingHandler {
      async run(): Promise<void> {
        throw new Error('no');
      }
    }
    await using app = await createApp({
      fronds: [frond('ops', { handlers: [{ ctor: RefusingHandler, deps: [], operations: { run: {} } }] })],
      createContainer,
      extensions: [log()],
    });

    await expect(createLocalRunner(app)({ address: 'refusing', op: 'run' }, Invocation.empty)).rejects.toThrow();

    expect(errors.some((line) => line.includes('[app:ops]') && line.includes('RefusingHandler.run'))).toBe(true);
  });

  it('writes none for the op that carries a line to its file', async () => {
    const lines = printed();
    await using app = await createApp({
      scan: () => scanProject(join(here, 'fixtures-app')),
      createContainer,
      extensions: [log(join(mkdtempSync(join(tmpdir(), 'fougere-log-')), 'lines.jsonl'))],
    });

    await createLocalRunner(app)({ address: 'order', op: 'create' }, { ...Invocation.empty, params: { id: '9' } });
    await new Promise((wake) => setTimeout(wake, 50));

    expect(lines.some((line) => line.includes('.record'))).toBe(false);
  });
});

describe('declared once in the config', () => {
  it('rises in a process started for one frond only, with no loader installed by the caller', async () => {
    const lines = printed();
    await using app = await boot({
      root: join(here, 'fixtures-app'),
      config: { fronds: { '@fougere/log': {} } },
      only: ['shop'],
    });

    await createLocalRunner(app)({ address: 'order', op: 'create' }, { ...Invocation.empty, params: { id: '1' } });

    expect(app.extensions()).toContain('log');
    expect(lines.some((line) => line.includes('OrderHandler.create'))).toBe(true);
  });
});
