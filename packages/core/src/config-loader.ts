import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import type { AuthConfig } from './boot/auth.js';
import type { LogLevel } from './builtin/logger.js';
import type { ConventionsInput } from './scan/conventions.js';
import { getModuleLoader } from './loader.js';

// ── Types ────────────────────────────────────────

export interface FougereConfig {
  /** Database configuration — the DEFAULT source, the one an entity lands in unnamed. */
  db?: 'sqlite' | { dialect: 'sqlite'; path?: string } | false;
  /** The other places rows live — a name, an engine, and the entities it holds. */
  sources?: Record<string, { dialect?: 'sqlite'; path?: string; entities: string[] }>;
  /** The names the scan reads instead of deriving them — the import scope, the fronds directory, the s… */
  conventions?: ConventionsInput;
  /** How much every logger says. */
  logLevel?: LogLevel;
  /** Remote fronds — frondName → base URL. */
  remotes?: Record<string, string>;
  /** Which realization answers which port — port class name → implementation class name. */
  ports?: Record<string, string>;
  /** Auth declaration — picks a provider package and forwards options to it. */
  auth?: AuthConfig;
  /** Which protocol adapters this app serves. */
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

async function loadConfigFrom(dir: string, fresh?: boolean): Promise<FougereConfig> {
  const loader = getModuleLoader();
  for (const file of CONFIG_FILES) {
    const path = resolve(dir, file);
    if (existsSync(path)) {
      // A module is cached by its specifier, so a second load of an EDITED file hands
      // back what was read the first time — measured, and it made re-reading a config
      // return the config already in force. The loader owns its own cache, so it is the
      // one told; the old module stays in memory, re-reading being for a change.
      const mod = await loader(path, fresh ? { fresh } : undefined);
      return ((mod as { default?: FougereConfig }).default ?? mod) as FougereConfig;
    }
  }
  return {};
}

/** Load the root fougere.config.{ts,js,mjs} from the given directory. */
export async function loadConfig(root: string, options?: { fresh?: boolean }): Promise<FougereConfig> {
  return loadConfigFrom(root, options?.fresh);
}

// ── Merging ──────────────────────────────────────

/** Override a config with another, the invariant of every cascade level: */
function mergeGlobal(base: FougereConfig, override: Partial<FougereConfig>): FougereConfig {
  const merged: FougereConfig = { ...base, ...override };
  if (base.remotes || override.remotes) {
    merged.remotes = { ...base.remotes, ...override.remotes };
  }
  return merged;
}

/** Load config along the workspace→app frontier. */
export async function loadCascadedConfig(workspaceRoot: string, appRoot: string): Promise<FougereConfig> {
  const base = await loadConfig(workspaceRoot);
  if (resolve(workspaceRoot) === resolve(appRoot)) return base;
  return mergeGlobal(base, await loadConfig(appRoot));
}
