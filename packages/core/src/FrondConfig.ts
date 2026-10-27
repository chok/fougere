import { resolve } from 'node:path';
import type { NameOf } from './NameOf.js';
import { existsSync } from 'node:fs';
import type { OperationOverride } from './OperationOverride.js';
import type { FougereFrondProtocols } from './FougereFrondProtocols.js';

export interface FrondConfig {
  /** Class names exposed as the frond's public contract (all surfaces). */
  expose?: (NameOf<'handler'> | NameOf<'entity'>)[];
  /** The entities this frond may read ACROSS sources, by name. */
  reads?: NameOf<'entity'>[];
  /** Per-surface entity lists. Overrides default deduction for each named surface. */
  surfaces?: Record<string, NameOf<'entity'>[]>;
  /**
   * The ops that FINISH a fact, in the order they run — by class name, keyed by fact.
   *
   * Declared by the frond that OWNS the fact, because ordering is a decision about the
   * fact itself and it has one owner. Without it two links refuse: nothing would say which
   * ran first, and scan order is not an answer.
   */
  pipes?: Record<NameOf<'entity'>, NameOf<'handler'>[]>;
  /**
   * The order this frond's links stand in front of a port, outside in — `ports: { Dispatcher: ['Timing',
   * 'Audit'] }`. A decision of the definition, where `ports:` in `fougere.config.ts` is the operator's
   * choice of what answers; the frond's wins for its own scope.
   */
  ports?: Record<string, string | readonly string[]>;
  /** What the frond says to each protocol about itself — `rest: { path: '/journal' }`. */
  protocols?: FougereFrondProtocols;
  /** Per-operation overrides, keyed the way an op is named: `post.list`. */
  operations?: Record<`${string}.${string}`, OperationOverride>;
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
  const path = frondConfigFileIn(frondPath);
  if (!path) return undefined;
  const mod = await import(path);

  return mod.default ?? mod;
}

/** The `frond.config.ts` a frond directory holds, if it holds one. */
export function frondConfigFileIn(frondPath: string): string | undefined {
  return FROND_CONFIG_FILES.map((file) => resolve(frondPath, file)).find((path) => existsSync(path));
}
