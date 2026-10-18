import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { packagesImportedBy } from '@fougere/compiler';
import { inDirectories, inPackages } from '../src/NamedPackage.js';

const tree = mkdtempSync(join(tmpdir(), 'named-package-'));
const packageAt = (path: string, manifest: object): string => {
  mkdirSync(join(tree, path), { recursive: true });
  writeFileSync(join(tree, path, 'package.json'), JSON.stringify(manifest));

  return join(tree, path);
};

const named = inPackages(new Set(['@fougere/adapter-sql', 'acme-fougere-redis']));

describe('a file Nitro must keep for what it runs at load', () => {
  it('belongs to a package the config names, installed under node_modules', () => {
    const installed = packageAt('node_modules/@fougere/adapter-sql', { name: '@fougere/adapter-sql' });

    expect(named(join(installed, 'dist/sqlite/index.js'))).toBe(true);
  });

  it('belongs to one whoever published it — a file it imports for its effect included', () => {
    const thirdParty = packageAt('node_modules/acme-fougere-redis', { name: 'acme-fougere-redis' });

    expect(named(join(thirdParty, 'dist/register.js'))).toBe(true);
  });

  it('belongs to one linked from a workspace, where no path says its name', () => {
    const linked = packageAt('packages/adapter/sql', { name: '@fougere/adapter-sql' });
    packageAt('packages/adapter/sql/dist', { type: 'module' });

    expect(named(join(linked, 'dist/sqlite/index.js'))).toBe(true);
  });

  it('is a package named, the way a dev build leaves it external', () => {
    expect(named('@fougere/adapter-sql')).toBe(true);
    expect(named('@fougere/adapter-sql/sqlite')).toBe(true);
    expect(named('@fougere/adapter-sql-extra')).toBe(false);
  });

  it('is not a package the config does not name, nor a virtual module', () => {
    const other = packageAt('node_modules/@fougere/adapter-file', { name: '@fougere/adapter-file' });

    expect(named(join(other, 'dist/index.js'))).toBe(false);
    expect(named('\0virtual:nitro')).toBe(false);
    expect(named('h3')).toBe(false);
  });
});

describe('the packages a config names by import', () => {
  it('is every package it imports, whatever the form, and nothing of the project', async () => {
    const config = join(tree, 'fougere.config.ts');
    writeFileSync(config, [
      `import '@fougere/adapter-sql/sqlite';`,
      `import 'acme-fougere-redis';`,
      `import { betterAuth } from '@fougere/auth-better';`,
      `import type { FougereConfig } from '@fougere/core';`,
      `import { readFileSync } from 'node:fs';`,
      `import { User } from './fronds/user/entities/User.js';`,
    ].join('\n'));

    expect((await packagesImportedBy(config)).sort()).toEqual(
      ['@fougere/adapter-sql', '@fougere/auth-better', '@fougere/core', 'acme-fougere-redis'],
    );
  });
});

describe('the files of a frond', () => {
  it('keeps every module under a frond directory, and none beside it', () => {
    const kept = inDirectories([join(tree, 'fronds/blog')]);

    expect(kept(join(tree, 'fronds/blog/vocabulary/slug.ts'))).toBe(true);
    expect(kept(join(tree, 'fronds/blogroll/entities/Link.ts'))).toBe(false);
    expect(kept(join(tree, 'server/api/hello.ts'))).toBe(false);
  });
});
