import { existsSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { SchemaError } from '@fougere/schema';
import { projectRootOf, type FougereConfig } from '../config/FougereConfig.js';

/** Where a project keeps its apps, one directory each. */
export const APPS = 'apps';

/** The apps a project holds: the directories under `apps/`. */
export function appsIn(root: string): string[] {
  const dir = join(root, APPS);
  if (!existsSync(dir)) return [];

  return readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
}

/**
 * The app a directory sits in, named by its directory under `apps/`.
 * Ex: `appNameOf('/shop', '/shop/apps/web/src')` is `web`.
 */
export function appNameOf(root: string, dir: string): string | undefined {
  const path = relative(join(root, APPS), dir);
  if (path === '' || path.startsWith('..')) return undefined;

  return path.split(sep)[0];
}

/**
 * The app a directory runs in, read off the project it belongs to — what a host that names none is.
 * Ex: `appRunningIn('/shop/apps/web')` is `web`.
 */
export function appRunningIn(dir: string): string | undefined {
  return appNameOf(projectRootOf(dir), dir);
}

/** Refuses an entry of `apps:` that names no directory under `apps/`, naming the ones there are. */
export function refuseUnknownApps(config: Pick<FougereConfig, 'apps'>, root: string): void {
  const held = appsIn(root);
  const unknown = Object.keys(config.apps ?? {}).filter((name) => !held.includes(name));
  if (unknown.length === 0) return;

  throw new SchemaError(`fougere.config.ts: apps.${unknown[0]} names no directory under ${APPS}/. `
    + `The project has ${held.map((name) => `'${name}'`).join(', ') || 'none'}.`);
}
