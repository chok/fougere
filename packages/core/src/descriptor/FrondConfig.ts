import { resolve } from 'node:path';
import type { NameOf } from '../NameOf.js';
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
  /** The ops that finish a fact, in the order they run, keyed by fact; declared by the fact's owner. */
  pipes?: Record<NameOf<'entity'>, NameOf<'handler'>[]>;
  /**
   * The order this frond's links stand in front of a port, outside in.
   * Ex: `ports: { Dispatcher: ['Timing', 'Audit'] }`.
   */
  ports?: Record<string, string | readonly string[]>;
  /** What the frond says to each protocol about itself — `rest: { path: '/journal' }`. */
  protocols?: FougereFrondProtocols;
  /** Per-operation overrides, keyed the way an op is named: `post.list`. */
  operations?: Record<`${string}.${string}`, OperationOverride>;
}


/** Define a frond configuration (typed identity helper). */
export function defineFrond(config: FrondConfig): FrondConfig {
  return config;
}


const FROND_CONFIG_FILES = ['frond.config.ts', 'frond.config.js', 'frond.config.mjs'];

/** A frond's `frond.config.{ts,js,mjs}`, or `undefined` when it has none. */
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
