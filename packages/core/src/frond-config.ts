import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import type { EntityConstructor, SchemaView } from '@fougere/schema';
import type { BindingPlan } from './boot/binding.js';

// ── Types ────────────────────────────────────────

/**
 * Per-operation override. Config takes precedence over conventions (isReadOp, facade lookup).
 *
 * Two families of keys, and they act at different depths:
 *
 * - **Resolution** (`kind`, `handler`, `method`) — intent and implementation, resolved
 *   once into core's `EffectiveOperation`; every local or remote door consumes it.
 * - **Projection** (`graphql`) — protocol vocabulary, read only by that adapter.
 * - **Contract** (`input`, `output`, `binding`) — what the op IS. Read by the façade,
 *   and this is the third producer of an {@link OperationContract}: a prefab DECLARES its
 *   ops (`Crud.__ops`), the scan DERIVES them from source, config STATES them outright.
 *   The façade cannot tell the three apart.
 *
 * Stating a contract here makes the scan optional rather than load-bearing. Two cases it
 * answers that nothing else does:
 * - a method inherited from an **installed** base class — the scan resolves nothing there
 *   (workspace-only heritage) and says nothing, so the op silently misses the façade;
 * - an operation inherited from a declaration unavailable to the project's type checker.
 *
 * Config wins over both other producers — it is the most explicit statement, made by
 * whoever assembles the app. Precedence: CLI > frond config > fougere config > scan >
 * conventions.
 */
export interface OperationOverride {
  /**
   * Force operation kind, over the naming convention (`isReadOp`).
   *
   * The convention reads the NAME, which is a weak signal — an app naming its reads in
   * domain terms (`ofBook`, `roots`, `bySlug`) matches no prefix and every one of them is
   * published as a mutation and a POST. This is the only place that fixes it.
   */
  kind?: 'query' | 'command';
  /**
   * The GraphQL root field this op answers to. Defaults to the method name.
   *
   * A GraphQL root is flat, so two handlers naming a method `ofBook` claim one field and
   * the build is refused, naming both. Nothing is renamed for you: the root vocabulary is
   * the app's, and a derived name would move the day a distant frond gained an entity.
   */
  graphql?: string;
  /**
   * Handler class to delegate to (overrides the default `{Entity}Handler` lookup).
   * Class name is used to resolve from DI. E.g. `ArchiveHandler` → `app.resolve('ArchiveHandler')`.
   */
  handler?: EntityConstructor;
  /** Method name on `handler` (defaults to the operation name). */
  method?: string;
  /**
   * CASL ability check (e.g. 'archive Post'). **Declared, not implemented** — no
   * reader interprets it today, in any adapter. Kept as the named slot for the
   * question rather than silently dropped, but do not rely on it: a config that
   * states a policy is not enforced anywhere.
   *
   * Wiring it means adopting a rules engine, which is precisely what the design
   * turns down: an identity-dependent right is judged INSIDE the operation
   * (`publish` reads `post.authorId !== user.id`), and a door-dependent one is a
   * surface. Neither needs a second vocabulary evaluated by a second engine.
   */
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
  /**
   * The entities this frond may read ACROSS sources, by name.
   *
   * It is not a permission checked after the fact: the list IS the environment a
   * cross-source query runs in — a source holding none of these is never opened, so
   * its tables do not exist in that connection. `facadeFor` excludes an entity with no
   * door on purpose ("it would publish the auth tables to anyone who asks"), and a SQL
   * door at app scope would hand them over; this is what keeps it shut.
   *
   * Declaring it is what makes `Sources` injectable here. A frond that declares none
   * asks for none, and nothing is attached on its behalf.
   */
  reads?: string[];
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
