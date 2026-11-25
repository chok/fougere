import { describe, it, expect } from 'vitest';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appNameOf, appsIn, refuseUnknownApps } from '../src/project/Apps.js';

function project(...apps: string[]): string {
  const root = mkdtempSync(join(tmpdir(), 'apps-'));
  for (const app of apps) mkdirSync(join(root, 'apps', app, 'src'), { recursive: true });

  return root;
}

describe('an app', () => {
  it('is named by its directory under apps/, from anywhere inside it', () => {
    const root = project('web');

    expect(appNameOf(root, join(root, 'apps', 'web'))).toBe('web');
    expect(appNameOf(root, join(root, 'apps', 'web', 'src'))).toBe('web');
  });

  it('has no name outside apps/', () => {
    const root = project('web');

    expect(appNameOf(root, root)).toBeUndefined();
    expect(appNameOf(root, join(root, 'apps'))).toBeUndefined();
  });

  it('is every directory under apps/', () => {
    expect(appsIn(project('web', 'ops'))).toEqual(['ops', 'web']);
    expect(appsIn(project())).toEqual([]);
  });
});

describe('apps: in the config', () => {
  it('refuses an entry naming no directory under apps/, naming the ones there are', () => {
    expect(() => refuseUnknownApps({ apps: { wbe: {} } }, project('web', 'ops')))
      .toThrow("fougere.config.ts: apps.wbe names no directory under apps/. The project has 'ops', 'web'.");
  });

  it('accepts an entry for each app the project holds', () => {
    expect(() => refuseUnknownApps({ apps: { web: {} } }, project('web'))).not.toThrow();
  });
});
