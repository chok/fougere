/**
 * A frond a config names by MODULE — `@fougere/log`, or a package of your own.
 *
 * A module that hands back an extension is refused: what a process carries is `platform:`'s.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { configModules } from '../src/project/ConfigModules.js';
import { setModuleLoader } from '../src/loader.js';
import { frond } from '../src/frond/FrondDeclaration.js';

const modules: Record<string, Record<string, unknown>> = {
  '@acme/audit': { audit: (path: unknown) => ({ name: 'audit', path, handlers: [] }) },
  '@acme/watch': { watch: (options: unknown) => ({ name: 'watch', options, up: () => {} }) },
  '@acme/silent': { somethingElse: () => ({}) },
  './fronds/local.ts': { default: () => ({ name: 'local', handlers: [] }) },
};

describe('configModules', () => {
  beforeEach(() => { setModuleLoader(async (id: string) => modules[id] ?? {}); });

  it('hands a descriptor over as a frond, named by its key', async () => {
    const { fronds } = await configModules({ cart: { extends: 'shop' }, '@acme/audit': { options: './lines.jsonl' } });

    expect(fronds).toEqual([{ name: '@acme/audit', path: './lines.jsonl', handlers: [] }]);
  });

  it('refuses an extension, naming the line platform: takes', async () => {
    await expect(configModules({ '@acme/watch': { options: 'x' } }))
      .rejects.toThrow("'@acme/watch' is an extension, which a process carries, not a frond. Move it to platform: — import { watch } from '@acme/watch', then platform: [watch('x')].");
  });

  it('reads the export off the last segment, and falls back to the default', async () => {
    const { fronds } = await configModules({ './fronds/local.ts': {} });

    expect(fronds.map((one) => one.name)).toEqual(['local']);
  });

  it('names the export a module was supposed to have', async () => {
    await expect(configModules({ '@acme/silent': {} }))
      .rejects.toThrow(/has no export named silent/);
  });

  it('says nothing about the fronds a scan finds on disk', async () => {
    const { fronds } = await configModules({ cart: { extends: 'shop' }, blog: {} });

    expect(fronds).toEqual([]);
  });

  it('hands over a frond the config built in place, with nothing to import', async () => {
    const auth = frond('auth');
    const { fronds } = await configModules({ blog: {}, auth });

    expect(fronds).toEqual([auth]);
  });

  it('refuses an entry whose key is not the name of the frond it holds', async () => {
    await expect(configModules({ login: frond('auth') })).rejects.toThrow("Rename the entry 'auth'");
  });
});
