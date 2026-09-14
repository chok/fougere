import { resolve } from 'node:path';
import type { NameOf } from './NameOf.js';
import { existsSync } from 'node:fs';
import type { OperationOverride } from './OperationOverride.js';

export interface FrondConfig {
  /** Class names exposed as the frond's public contract (all surfaces). */
  expose?: (NameOf<'handler'> | NameOf<'entity'>)[];
  /** The entities this frond may read ACROSS sources, by name. */
  reads?: NameOf<'entity'>[];
  /** Per-surface entity lists. Overrides default deduction for each named surface. */
  surfaces?: Record<string, NameOf<'entity'>[]>;
  /** Interface → implementation bindings for DI (e.g. { Database: 'SqliteDatabase' }). */
  bindings?: Record<string, NameOf<'provider'>>;
  /**
   * The ops that FINISH a fact, in the order they run — by class name, keyed by fact.
   *
   * Declared by the frond that OWNS the fact, because ordering is a decision about the
   * fact itself and it has one owner. Without it two links refuse: nothing would say which
   * ran first, and scan order is not an answer.
   */
  pipes?: Record<NameOf<'entity'>, NameOf<'handler'>[]>;
  /**
   * How far a middleware reaches, by class name. A middleware answers for its own frond
   * without being named here; `'app'` is the exception, and it is stated by the frond
   * that decides for the others.
   */
  middlewares?: Record<NameOf<'middleware'>, 'frond' | 'app'>;
  /** Per-operation overrides. Key = operation name (method name on a handler). */
  operations?: Record<string, OperationOverride>;
}

// ── Helper ───────────────────────────────────────

/** Define a frond configuration (typed identity helper). */
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
