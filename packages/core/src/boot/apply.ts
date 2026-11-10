import type { FougereConfig } from '../config/FougereConfig.js';
import { envLevel, logLevel, setLogLevel } from '../builtin/Logger.js';
import { maxBodyBytes, setMaxBodyBytes } from '../wire/BodyLimit.js';
import { dequal } from 'dequal';

export interface ConfigApplication {
  /** What this call changed in the running process. */
  applied: string[];
  /** What differs from the config in force and did NOT take effect. */
  pending: string[];
}

const CONSULTED = new Set(['logLevel', 'maxBodyBytes']);

/**
 * What a re-read config changes in a running process.
 *
 * Documented: [lifecycle](https://fougere.dev/docs/run/lifecycle).
 */
export function applyConfig(next: FougereConfig, inForce?: FougereConfig): ConfigApplication {
  const applied: string[] = [];
  const pending: string[] = [];

  const wanted = envLevel() ?? next.logLevel ?? logLevel();
  const before = logLevel();
  if (wanted !== before) {
    setLogLevel(wanted);
    applied.push(`logLevel: ${before} → ${wanted}`);
  }

  const limit = next.maxBodyBytes ?? maxBodyBytes();
  if (limit !== maxBodyBytes()) {
    applied.push(`maxBodyBytes: ${maxBodyBytes()} → ${limit}`);
    setMaxBodyBytes(limit);
  }

  for (const key of new Set([...Object.keys(next), ...Object.keys(inForce ?? {})])) {
    if (CONSULTED.has(key) || !inForce) continue;
    if (!dequal((next as Record<string, unknown>)[key], (inForce as Record<string, unknown>)[key])) {
      pending.push(key);
    }
  }

  return { applied, pending };
}
