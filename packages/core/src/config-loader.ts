import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import type { AuthConfig } from './boot/auth.js';
import { getModuleLoader } from './scan/scanner.js';

// ── Types ────────────────────────────────────────

export interface FougereConfig {
  /** Database configuration — the DEFAULT source, the one an entity lands in unnamed. */
  db?: 'sqlite' | { dialect: 'sqlite'; path?: string } | false;
  /**
   * The other places rows live — a name, an engine, and the entities it holds.
   *
   * A fact about the APP, stated beside `remotes:` because it is the same kind of
   * statement: `remotes:` says where a CALL goes, this says where a ROW is. Neither
   * belongs on the entity, which describes itself and not its deployment.
   *
   * Only the exception is declared: everything unnamed stays in `db`. Membership is
   * per ENTITY rather than per frond — two fronds may share a database, and one frond
   * may hold entities in two — so the entity is the truth and a frond-wide shorthand
   * waits for a case that needs it.
   *
   * A `ref()` across two sources gets no foreign key: two databases share no
   * constraint. The DDL stops pretending rather than the `ref` being refused.
   */
  sources?: Record<string, { dialect?: 'sqlite'; path?: string; entities: string[] }>;
  /** Directory containing fronds. Defaults to 'fronds'. */
  frondsDir?: string;
  /** Remote fronds — frondName → base URL. */
  remotes?: Record<string, string>;
  /** Auth declaration — picks a provider package and forwards options to it. */
  auth?: AuthConfig;
  /**
   * Which protocol adapters this app serves.
   *
   * A fact about the APP, declared once beside `db`, `remotes` and `auth` — not a
   * property of whichever host runs it. Before this existed the same decision was
   * spelled five different ways: Nuxt mounted REST unconditionally, the Web hosts
   * served it if you happened to create a route file, and Express if you happened to
   * call a middleware. One decision, five dialects, no canonical place.
   *
   * Absent means not served. The call envelope is not listed here: it is the wire the
   * client primitives use, not a projection an app chooses to publish.
   */
  adapters?: AdapterConfig;
}

/** Protocol adapters, by the name of the package that provides them. */
export interface AdapterConfig {
  /** `@fougere/adapter-rest` — REST under `/api/{frond}/{plural}`. */
  rest?: boolean;
  /** `@fougere/adapter-graphql` — a GraphQL schema over the same operations. */
  graphql?: boolean;
  /** A surface of your own; the framework only records that you declared it. */
  [adapter: string]: boolean | undefined;
}

// ── Loading ──────────────────────────────────────

const CONFIG_FILES = ['fougere.config.ts', 'fougere.config.js', 'fougere.config.mjs'];

async function loadConfigFrom(dir: string): Promise<FougereConfig> {
  const loader = getModuleLoader();
  for (const file of CONFIG_FILES) {
    const path = resolve(dir, file);
    if (existsSync(path)) {
      const mod = await loader(path);
      return ((mod as { default?: FougereConfig }).default ?? mod) as FougereConfig;
    }
  }
  return {};
}

/**
 * Load the root fougere.config.{ts,js,mjs} from the given directory.
 */
export async function loadConfig(root: string): Promise<FougereConfig> {
  return loadConfigFrom(root);
}

// ── Merging ──────────────────────────────────────

/**
 * Override a config with another, the invariant of every cascade level:
 * scalar keys replace, but `remotes` (the topology) MERGES — an override adds
 * or redirects a frond without erasing the others. Used for workspace→app and
 * for global→CLI alike.
 */
function mergeGlobal(base: FougereConfig, override: Partial<FougereConfig>): FougereConfig {
  const merged: FougereConfig = { ...base, ...override };
  if (base.remotes || override.remotes) {
    merged.remotes = { ...base.remotes, ...override.remotes };
  }
  return merged;
}

/**
 * Load config along the workspace→app frontier. The workspace-root config is
 * the base (canonical topology: `remotes`, shared `db`); the app-root config
 * overrides. Same `root` boundary the fronds already cascade along. When both
 * roots resolve to the same dir (single app, no workspace), this is the plain
 * root config — idempotent, no behavior change.
 */
export async function loadCascadedConfig(workspaceRoot: string, appRoot: string): Promise<FougereConfig> {
  const base = await loadConfig(workspaceRoot);
  if (resolve(workspaceRoot) === resolve(appRoot)) return base;
  return mergeGlobal(base, await loadConfig(appRoot));
}
