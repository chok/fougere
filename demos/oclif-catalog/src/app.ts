import { bootApp } from '@fougere/defaults';
import type { App } from '@fougere/core';
import { join } from 'node:path';

/** The app, booted from the frond next door. Nothing in it names a terminal. */
export function catalog(): Promise<App> {
  return bootApp(join(import.meta.dirname, '..'));
}
