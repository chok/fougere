import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import type { EntityConstructor, SchemaView } from '@fougere/schema';
import type { BindingPlan } from './wire/binding.js';

// ── Types ────────────────────────────────────────

/** Per-operation override. */
export interface OperationOverride {
  /** Force operation kind, over the naming convention (`isReadOp`). */
  kind?: 'query' | 'command';
  /** The GraphQL root field this op answers to. */
  graphql?: string;
  /**
   * Handler class to delegate to (overrides the default `{Entity}Handler` lookup).
   * Class name is used to resolve from DI. E.g. `ArchiveHandler` → `app.resolve('ArchiveHandler')`.
   */
  handler?: EntityConstructor;
  /** Method name on `handler` (defaults to the operation name). */
  method?: string;
  /** CASL ability check (e.g. */
  policy?: string;

  // ── The contract itself — see the note above ──

  /** What judges the input. The view carries its own mode (`partial()` → patch). */
  input?: SchemaView;
  /**
   * Where each argument is read from — states what the scan would otherwise derive
   * from the method signature. An empty array is meaningful: "this op takes nothing".
   */
  binding?: BindingPlan;

  /** Per-operation output view, below prefab declarations and above handler/entity defaults. */
  output?: SchemaView;
}

export interface FrondConfig {
  /** Class names exposed as the frond's public contract (all surfaces). */
  expose?: string[];
  /** The entities this frond may read ACROSS sources, by name. */
  reads?: string[];
  /** Per-surface entity lists. Overrides default deduction for each named surface. */
  surfaces?: Record<string, string[]>;
  /** Interface → implementation bindings for DI (e.g. { Database: 'SqliteDatabase' }). */
  bindings?: Record<string, string>;
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
