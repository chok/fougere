/**
 * `withFougere`, pinned — and every assertion is a bug this file already had.
 *
 * It replaced the WHOLE minimizer array, which silently dropped Next's CSS
 * minifier and anything the app's own `webpack()` had added. Codex caught that by
 * reading the code; nothing here would have caught it, so now something does.
 *
 * Next's minimizers are plain functions with no readable options, so they are told
 * apart by their source — which means a test can stand in for them with functions
 * whose source says the same thing. That is the contract being pinned: the JS
 * minifier is identified by loading `minify-webpack-plugin`, and nothing else is
 * touched.
 */
import { describe, it, expect, vi } from 'vitest';
import { withFougere } from '../src/config.js';

/** Stand-ins shaped like Next's real minimizers: functions naming their plugin. */
const nextJsMinifier = () => require('./webpack/plugins/minify-webpack-plugin/src');
const nextCssMinifier = () => require('./webpack/plugins/css-minimizer-plugin');

function runWebpack(config: ReturnType<typeof withFougere>, webpackConfig: any = {}) {
  const context = { isServer: true } as any;
  return (config.webpack as (c: any, ctx: any) => any)(webpackConfig, context);
}

describe('serverExternalPackages', () => {
  it('lists what a boot loads at runtime — it reads frond sources off disk', () => {
    const list = withFougere().serverExternalPackages!;
    expect(list).toContain('jiti');
    expect(list).toContain('@fougere/core');
    expect(list).toContain('better-sqlite3');
  });

  it('adds to the app\'s own list rather than replacing it', () => {
    const list = withFougere({ serverExternalPackages: ['sharp'] }).serverExternalPackages!;
    expect(list).toContain('sharp');
    expect(list).toContain('jiti');
  });

  it('lists each package once', () => {
    const list = withFougere({ serverExternalPackages: ['jiti'] }).serverExternalPackages!;
    expect(list.filter((p) => p === 'jiti')).toHaveLength(1);
  });

  it('leaves the rest of the config untouched', () => {
    expect(withFougere({ reactStrictMode: true }).reactStrictMode).toBe(true);
  });
});

describe('the minimizer', () => {
  it('replaces the JS minifier so class names survive', () => {
    const result = runWebpack(withFougere(), {
      optimization: { minimizer: [nextJsMinifier] },
    });

    expect(result.optimization.minimizer).toHaveLength(1);
    expect(result.optimization.minimizer[0]).not.toBe(nextJsMinifier);
    // Its constructor, not its option storage: how TerserPlugin keeps what it was
    // handed is its business, and asserting on it would pin the library's internals.
    expect(result.optimization.minimizer[0].constructor.name).toBe('TerserPlugin');
  });

  it('keeps the CSS minifier — replacing the whole array dropped it', () => {
    const result = runWebpack(withFougere(), {
      optimization: { minimizer: [nextJsMinifier, nextCssMinifier] },
    });

    expect(result.optimization.minimizer).toContain(nextCssMinifier);
    expect(result.optimization.minimizer).not.toContain(nextJsMinifier);
  });

  it('keeps a minimizer the app added itself', () => {
    const mine = () => 'mine';
    const result = runWebpack(withFougere(), {
      optimization: { minimizer: [nextJsMinifier, mine] },
    });
    expect(result.optimization.minimizer).toContain(mine);
  });

  it('works on a config that declares no minimizer at all', () => {
    const result = runWebpack(withFougere(), {});
    expect(result.optimization.minimizer).toHaveLength(1);
  });
});

describe('the app\'s own webpack function', () => {
  it('runs first, and on the untouched config', () => {
    const seen: unknown[] = [];
    const userWebpack = vi.fn((c: any) => {
      seen.push(c.optimization?.minimizer?.length ?? 0);
      return c;
    });

    runWebpack(withFougere({ webpack: userWebpack }), {
      optimization: { minimizer: [nextJsMinifier] },
    });

    expect(userWebpack).toHaveBeenCalledOnce();
    // One minimizer, Next's own — proof it did not see ours.
    expect(seen).toEqual([1]);
  });

  it('keeps what it returned', () => {
    const result = runWebpack(
      withFougere({ webpack: (c: any) => ({ ...c, marker: 'kept' }) }),
      { optimization: { minimizer: [nextJsMinifier] } },
    );
    expect(result.marker).toBe('kept');
  });

  it('is handed the context Next gives', () => {
    const userWebpack = vi.fn((c: any, _ctx: any) => c);
    runWebpack(withFougere({ webpack: userWebpack }));
    expect(userWebpack.mock.calls[0]![1]).toMatchObject({ isServer: true });
  });
});
