import type { FougereConfig } from '../config-loader.js';
import { setLogLevel, logLevel, envLevel } from '../builtins/logger.js';

export interface ConfigApplication {
  /** What this call changed in the running process. */
  applied: string[];
  /** What differs from the config in force and did NOT take effect. */
  pending: string[];
}

/**
 * What a (re-)read config changes in a process that is already running.
 *
 * The rule it realizes, and the only one worth remembering: **a value that is
 * CONSULTED can change under a running app; a value that was CONSUMED to build
 * something cannot, without rebuilding what it built.** `logLevel` is consulted at
 * every emission, so it moves. `db` opened a connection, `ports:` registered a class,
 * the entities built façades — those are consumed, and this function reports them
 * rather than pretending.
 *
 * The list of consulted keys is not declared anywhere: a key is consulted when this
 * function does something with it, which is the only definition that cannot go stale.
 */
export function applyConfig(next: FougereConfig, inForce?: FougereConfig): ConfigApplication {
  const applied: string[] = [];
  const pending: string[] = [];

  // The CLI speaks through the environment, so it keeps winning over the file — read
  // through `envLevel`, which is where the environment is already judged. Casting it
  // here was a second reader that validated nothing: `FOUGERE_LOG_LEVEL=verbose` set
  // the threshold to `undefined` and every log passed.
  const wanted = envLevel() ?? next.logLevel ?? 'debug';
  const before = logLevel();
  if (wanted !== before) {
    setLogLevel(wanted);
    applied.push(`logLevel: ${before} → ${wanted}`);
  }

  for (const key of new Set([...Object.keys(next), ...Object.keys(inForce ?? {})])) {
    if (key === 'logLevel' || !inForce) continue;
    if (!same((next as Record<string, unknown>)[key], (inForce as Record<string, unknown>)[key])) {
      pending.push(key);
    }
  }
  return { applied, pending };
}

/** Equal enough to decide "nothing changed". Anything unserialisable counts as changed. */
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}
