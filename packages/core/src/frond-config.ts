import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

// ── Types ────────────────────────────────────────

/**
 * Per-operation override. Config takes precedence over conventions (isReadOp, facade lookup).
 *
 * Use this when:
 * - A method name doesn't fit default verb conventions (`republishPost` → `kind: 'command'`)
 * - An op should be routed to a different handler than `{Entity}Handler` (`handler`/`method`)
 * - An op is guarded by a CASL policy (`policy`)
 */
export interface OperationOverride {
  /** Force operation kind (overrides isReadOp-based default). */
  kind?: 'query' | 'command';
  /**
   * Handler class to delegate to (overrides the default `{Entity}Handler` lookup).
   * Class name is used to resolve from DI. E.g. `ArchiveHandler` → `app.resolve('ArchiveHandler')`.
   */
  handler?: abstract new (...args: any[]) => any;
  /** Method name on `handler` (defaults to the operation name). */
  method?: string;
  /** CASL ability check (e.g. 'archive Post'). Evaluated before the handler runs. Opt-in. */
  policy?: string;
}

export interface FrondConfig {
  /** Class names exposed as the frond's public contract (all surfaces). */
  expose?: string[];
  /** Per-surface entity lists. Overrides default deduction for each named surface. */
  surfaces?: Record<string, string[]>;
  /** Interface → implementation bindings for DI (e.g. { Database: 'SqliteDatabase' }). */
  bindings?: Record<string, string>;
  /** Per-operation overrides. Key = operation name (method name on a handler). */
  operations?: Record<string, OperationOverride>;
}

// ── Helper ───────────────────────────────────────

/**
 * Define a frond configuration (typed identity helper).
 *
 * ```ts
 * // fronds/auth/frond.config.ts
 * import { defineFrond } from '@fougere/core'
 * export default defineFrond({ expose: ['User', 'AuthHandler'] })
 * ```
 */
export function defineFrond(config: FrondConfig): FrondConfig {
  return config;
}

// ── Loading ──────────────────────────────────────

const FROND_CONFIG_FILES = ['frond.config.ts', 'frond.config.js', 'frond.config.mjs'];

/**
 * Load a frond's `frond.config.{ts,js,mjs}` from the given frond directory.
 * Returns `undefined` if no config file is found.
 */
export async function loadFrondConfig(frondPath: string): Promise<FrondConfig | undefined> {
  for (const file of FROND_CONFIG_FILES) {
    const path = resolve(frondPath, file);
    if (existsSync(path)) {
      const mod = await import(path);
      return mod.default ?? mod;
    }
  }
  return undefined;
}
