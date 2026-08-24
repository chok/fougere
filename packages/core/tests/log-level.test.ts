/**
 * The level moves without rebuilding anything.
 *
 * It used to be copied into each Logger by the constructor and copied again by
 * `child()`, so there was no place where "the level" was: changing it meant
 * rebuilding every logger AND every handler that had been handed one. The handler
 * still holds the same object; what it reads is now consulted at emission.
 */
import { execFileSync } from 'node:child_process';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Logger, setLogLevel, logLevel, applyConfig } from '../src/index.js';
import { loadConfig } from '../src/node.js';

afterEach(() => { setLogLevel('info'); vi.restoreAllMocks(); });

/**
 * What the logger SAID, whichever console method carried it — one per level now, so a
 * spy on `log` alone would miss every `info` and every `debug`.
 */
const said = (fn: () => void): string[] => {
  const lines: string[] = [];
  const take = (...a: unknown[]) => { lines.push(a.join(' ')); };
  const spies = (['debug', 'info', 'log', 'warn', 'error'] as const)
    .map((method) => vi.spyOn(console, method).mockImplementation(take));
  fn();
  for (const spy of spies) spy.mockRestore();
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

  /**
   * The key order of an object literal is not a change, and a hand-written comparison by
   * serialisation said it was. `applyConfig` now shares the one equality Schema declares,
   * so a re-read config that only moved its members reports nothing pending.
   */
  it('does not report a key as pending when only the member order moved', () => {
    setLogLevel('warn');
    const out = applyConfig(
      { logLevel: 'warn', remotes: { blog: 'http://a', shop: 'http://b' } },
      { logLevel: 'warn', remotes: { shop: 'http://b', blog: 'http://a' } },
    );

    expect(out.pending).toEqual([]);
  });

  it('still reports a key whose value actually moved', () => {
    setLogLevel('warn');
    const out = applyConfig(
      { logLevel: 'warn', remotes: { blog: 'http://a' } },
      { logLevel: 'warn', remotes: { blog: 'http://elsewhere' } },
    );

    expect(out.pending).toEqual(['remotes']);
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

/**
 * The level a process was STARTED with, which only a second process can observe: the
 * threshold is seeded when the module loads, and `vi.stubEnv` runs long after that.
 *
 * Found by demos/mirror-catalog — `FOUGERE_LOG_LEVEL=warn` still printed the boot's
 * first line, because until then only `applyConfig` moved the threshold and it runs
 * after the boot has said where its root is.
 */
describe('a process started at a level', () => {
  it('applies it to the very first emission, before any config is read', () => {
    const probe = `import { Logger } from ${JSON.stringify(new URL('../src/builtins/logger.ts', import.meta.url).href)};`
      + ` new Logger('probe').info('should not appear'); console.log('END');`;
    const out = execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', probe], {
      env: { ...process.env, FOUGERE_LOG_LEVEL: 'warn' },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    expect(out).not.toContain('should not appear');
    expect(out).toContain('END');
  });
});

/**
 * A level nobody knows.
 *
 * `applyConfig` read `FOUGERE_LOG_LEVEL` through a cast while `envLevel` — one module
 * away — already judged it. So `verbose` reached `setLogLevel`, the threshold became
 * `undefined`, and every comparison against it was `NaN`: nothing filtered, and
 * `logLevel()` answered its own fallback rather than what was in force.
 */
describe('an unknown log level', () => {
  it('loses to the file, and does not open the floodgates', () => {
    vi.stubEnv('FOUGERE_LOG_LEVEL', 'verbose');

    applyConfig({ logLevel: 'error' }, {});

    expect(logLevel()).toBe('error');
    expect(said(() => { new Logger('t').debug('should not appear'); })).toEqual([]);
    vi.unstubAllEnvs();
  });

  it('is refused by name at the door, so a cast cannot smuggle one in', () => {
    expect(() => setLogLevel('verbose' as never)).toThrow(/Unknown log level: 'verbose'/);
    expect(() => setLogLevel('verbose' as never)).toThrow(/debug, info, warn, error, silent/);
  });
});
