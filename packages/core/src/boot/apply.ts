import type { FougereConfig } from '../config-loader.js';
import { setLogLevel, logLevel, envLevel } from '../builtin/logger.js';
import { dequal } from 'dequal';

export interface ConfigApplication {
  /** What this call changed in the running process. */
  applied: string[];
  /** What differs from the config in force and did NOT take effect. */
  pending: string[];
}

/**
 * What a (re-)read config changes in a process that is already running.
 *
 * Documented: [lifecycle](https://fougere.dev/docs/infra/lifecycle).
 */
export function applyConfig(next: FougereConfig, inForce?: FougereConfig): ConfigApplication {
  const applied: string[] = [];
  const pending: string[] = [];

  // The CLI speaks through the environment, so it keeps winning over the file — read
  // through `envLevel`, which is where the environment is already validated. Casting it
  // here was a second reader that validated nothing: `FOUGERE_LOG_LEVEL=verbose` set
  // the threshold to `undefined` and every log passed.
  // A process that declares no level keeps the one it started with — `info`, or whatever
  // the host set for itself before booting. Defaulting to `debug` here meant every caller
  // of this function silently raised the threshold: the CLI sets `warn` and got `debug`
  // back, and the day a web host started calling it, `pnpm dev` would have traced every
  // dispatch of an app that asked for nothing.
  const wanted = envLevel() ?? next.logLevel ?? logLevel();
  const before = logLevel();
  if (wanted !== before) {
    setLogLevel(wanted);
    applied.push(`logLevel: ${before} → ${wanted}`);
  }

  for (const key of new Set([...Object.keys(next), ...Object.keys(inForce ?? {})])) {
    if (key === 'logLevel' || !inForce) continue;
    if (!dequal((next as Record<string, unknown>)[key], (inForce as Record<string, unknown>)[key])) {
      pending.push(key);
    }
  }
  return { applied, pending };
}
