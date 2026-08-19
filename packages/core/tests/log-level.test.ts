/**
 * The level moves without rebuilding anything.
 *
 * It used to be copied into each Logger by the constructor and copied again by
 * `child()`, so there was no place where "the level" was: changing it meant
 * rebuilding every logger AND every handler that had been handed one. The handler
 * still holds the same object; what it reads is now consulted at emission.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Logger, setLogLevel, logLevel, applyConfig, loadConfig } from '../src/index.js';

afterEach(() => { setLogLevel('info'); vi.restoreAllMocks(); });

const said = (fn: () => void): string[] => {
  const lines: string[] = [];
  const spy = vi.spyOn(console, 'log').mockImplementation((...a) => { lines.push(a.join(' ')); });
  fn();
  spy.mockRestore();
  return lines;
};

describe('the log level', () => {
  it('reaches a logger built BEFORE it changed — the reference is kept, not rebuilt', () => {
    const log = new Logger('app');

    expect(said(() => log.debug('quiet'))).toHaveLength(0);
    setLogLevel('debug');
    expect(said(() => log.debug('loud'))).toHaveLength(1);
  });

  it('reaches a child built before the change too', () => {
    const child = new Logger('app').child('blog');

    setLogLevel('debug');
    expect(said(() => child.debug('loud'))).toHaveLength(1);
  });

  it('silences everything, which is what a level of its own would have missed', () => {
    const log = new Logger('app');
    setLogLevel('silent');

    expect(said(() => { log.debug('a'); log.info('b'); })).toHaveLength(0);
  });
});

describe('applyConfig', () => {
  it('applies the level and says what it changed', () => {
    setLogLevel('info');
    const out = applyConfig({ logLevel: 'warn' });

    expect(logLevel()).toBe('warn');
    expect(out.applied).toEqual(['logLevel: info → warn']);
    expect(out.pending).toEqual([]);
  });

  it('reports what changed and did NOT take effect, rather than pretending', () => {
    setLogLevel('warn');
    const out = applyConfig(
      { logLevel: 'warn', db: 'sqlite', ports: { Payment: 'OgonePayment' } },
      { logLevel: 'warn', db: false, ports: { Payment: 'StripePayment' } },
    );

    expect(out.applied).toEqual([]);
    expect(out.pending.sort()).toEqual(['db', 'ports']);
  });

  it('lets the environment win over the file — the CLI speaks that way', () => {
    vi.stubEnv('FOUGERE_LOG_LEVEL', 'error');
    setLogLevel('info');

    applyConfig({ logLevel: 'debug' });

    expect(logLevel()).toBe('error');
    vi.unstubAllEnvs();
  });
});

describe('loadConfig re-reading a file that changed', () => {
  it('answers the new content, which the module cache alone does not', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'fougere-reload-'));
    const file = join(dir, 'fougere.config.mjs');

    await writeFile(file, "export default { logLevel: 'warn' };\n");
    expect((await loadConfig(dir)).logLevel).toBe('warn');

    await writeFile(file, "export default { logLevel: 'error' };\n");
    // Without `fresh`, the specifier is the same and the module is the one already read.
    expect((await loadConfig(dir)).logLevel).toBe('warn');
    expect((await loadConfig(dir, { fresh: true })).logLevel).toBe('error');

    await rm(dir, { recursive: true, force: true });
  });
});
