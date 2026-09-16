/**
 * A frond a config names by MODULE — `@fougere/log`, or a package of your own.
 *
 * Which of the two doors it goes through is read off what the module hands back, so the
 * author of a config does not have to know whether their package exports a frond or an
 * extension: the same reading `extensions/` already does off a module's form.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { statedModules } from '../src/StatedModules.js';
import { setModuleLoader } from '../src/loader.js';

const modules: Record<string, Record<string, unknown>> = {
  '@acme/audit': { audit: (path: unknown) => ({ name: 'audit', path, handlers: [] }) },
  '@acme/watch': { watch: (options: unknown) => ({ name: 'watch', options, up: () => {} }) },
  '@acme/silent': { somethingElse: () => ({}) },
  './fronds/local.ts': { default: () => ({ name: 'local', handlers: [] }) },
};

describe('statedModules', () => {
  beforeEach(() => { setModuleLoader(async (id: string) => modules[id] ?? {}); });

  it('sends a descriptor to the fronds and a rising shape to the extensions', async () => {
    const { fronds, extensions } = await statedModules({
      cart: { extends: 'shop' },
      '@acme/audit': './lines.jsonl',
      '@acme/watch': {},
    });

    expect(fronds).toEqual([{ name: 'audit', path: './lines.jsonl', handlers: [] }]);
    expect(extensions.map((one) => (one as { name: string }).name)).toEqual(['watch']);
  });

  it('reads the export off the last segment, and falls back to the default', async () => {
    const { fronds } = await statedModules({ './fronds/local.ts': {} });

    expect(fronds.map((one) => one.name)).toEqual(['local']);
  });

  it('names the export a module was supposed to have', async () => {
    await expect(statedModules({ '@acme/silent': {} }))
      .rejects.toThrow(/exports no 'silent'/);
  });

  it('says nothing about the fronds a scan finds on disk', async () => {
    const { fronds, extensions } = await statedModules({ cart: { extends: 'shop' }, blog: 'http://a' });

    expect(fronds).toEqual([]);
    expect(extensions).toEqual([]);
  });
});
