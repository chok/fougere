import { bootApp } from '@fougere/defaults';
import { setLogLevel, type App } from '@fougere/core';
import { join } from 'node:path';

/**
 * The app, booted from the frond next door. Nothing in it names a terminal.
 *
 * The one thing a terminal DOES change: stdout is a protocol. `product:list --json` is meant
 * to reach `jq`, and `Logger` writes with `console.info`, which is stdout — seven lines of boot
 * before the `[` and nothing can parse it. So the boot is quiet here, and a refusal still
 * reaches stderr where a shell expects it.
 */
export function catalog(): Promise<App> {
  setLogLevel('error');

  return bootApp(join(import.meta.dirname, '..'));
}
