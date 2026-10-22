import { dirname, join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import type { LogLevel } from './builtin/LogLevel.js';
import type { ConventionsInput } from './ConventionsInput.js';
import type { SourceConfig } from './SourceConfig.js';
import type { PortChoice } from './PortChoice.js';
import { getModuleLoader } from './loader.js';
import type { ProtocolConfig } from './Protocol.js';
import { mergeFrondEntries, statesModule, type FrondEntries } from './FrondEntries.js';
import { keyedFrondEntries } from './KeyedFrondEntry.js';
import { DEFAULT_CONVENTIONS } from './Conventions.js';
import type { StateEntry } from './FougereStates.js';

export interface FougereConfig {
  /**
   * Where rows live — a name, a type and what it admits, and the entities it holds. The one entry
   * listing no entities is the default source; none at all keeps the rows in memory.
   */
  sources?: Record<string, SourceConfig>;
  /**
   * The names the scan reads instead of deriving them — the import scope, the fronds directory,
   * every convention directory.
   */
  conventions?: ConventionsInput;
  /** How much every logger says. */
  logLevel?: LogLevel;
  /** How many bytes a caller may send in one call — 2 MiB when unsaid. Consulted at every door. */
  maxBodyBytes?: number;
  /**
   * What this app is made of, and who inherits code from whom. The key is a frond name or a
   * module specifier; nesting says only that a child resolves what its parent declared.
   */
  fronds?: FrondEntries;
  /** What answers a port — a name, or the chain from the outside in. */
  ports?: PortChoice;
  /** The protocols this app serves beside its own calls — named here, made available by an import. */
  protocols?: ProtocolConfig;
  /**
   * How each name of the caller's state is kept between requests — `{ cart: { cookie: { maxAge:
   * 604800 } } }` — named here, the way to keep it fromExtension by an import (`@fougere/state-cookie`).
   */
  state?: Record<string, StateEntry>;
}

const CONFIG_FILES = ['fougere.config.ts', 'fougere.config.js', 'fougere.config.mjs'];

/** The config file a directory holds, if it holds one. */
export function configFileIn(dir: string): string | undefined {
  return CONFIG_FILES.map((file) => resolve(dir, file)).find((path) => existsSync(path));
}

const STATEMENT_FILES = ['fronds.ts', 'fronds.mts', 'fronds.js', 'fronds.mjs'];

/** Where `fougere build` writes the project as JavaScript, and `fougere serve` starts it from. */
export const BUILD_DIRECTORY = join('.fougere', 'build');

/** The fronds a directory states by hand — `frond()` calls beside the config, booted with no scan. */
export function statementFileIn(dir: string): string | undefined {
  return STATEMENT_FILES.map((file) => resolve(dir, file)).find((path) => existsSync(path));
}

/**
 * The project an app belongs to: the nearest directory, from `dir` up, that holds the fronds —
 * or, holding none yet, a config file. An app under `apps/` finds its workspace, and an app that
 * keeps its own fronds is its own project, with nothing written in either.
 */
export function projectRootOf(dir: string): string {
  const up = (holds: (at: string) => boolean): string | undefined => {
    for (let at = resolve(dir); ; at = dirname(at)) {
      if (holds(at)) return at;
      if (dirname(at) === at) return undefined;
    }
  };

  return up((at) => existsSync(join(at, DEFAULT_CONVENTIONS.fronds))) ?? up((at) => configFileIn(at) !== undefined) ?? resolve(dir);
}

async function loadConfigFrom(dir: string, fresh?: boolean): Promise<FougereConfig> {
  const path = configFileIn(dir);
  if (!path) return {};

  // A module is cached by its specifier, so a second load of an EDITED file hands back what
  // was read the first time. The loader owns its own cache, so it is the one told.
  const mod = await getModuleLoader()(path, fresh ? { fresh } : undefined);

  return ((mod as { default?: FougereConfig }).default ?? mod) as FougereConfig;
}

/** Load the root fougere.config.{ts,js,mjs} from the given directory. */
export async function loadConfig(root: string, options?: { fresh?: boolean }): Promise<FougereConfig> {
  return loadConfigFrom(root, options?.fresh);
}

/**
 * Where each frond answers — a string leaf of `fronds:`, which is the one place a config says
 * it. `CreateAppOptions.remotes` still takes this shape: the option is what the whole boot
 * reads, and translating here is what keeps it from learning about the tree.
 */
export function remotesOf(config: FougereConfig): Record<string, string> {
  const addresses: Record<string, string> = {};
  for (const entry of keyedFrondEntries(config.fronds)) {
    if (entry.value !== undefined && !statesModule(entry.key)) addresses[entry.key] = entry.value;
  }

  return addresses;
}

// ── Merging ──────────────────────────────────────

/**
 * Override a config with another, the invariant of every cascade level: scalar keys replace, but
 * the one that says what this app is made of MERGES — an override adds or redirects a frond
 * without erasing the others.
 */
function mergeGlobal(base: FougereConfig, override: Partial<FougereConfig>): FougereConfig {
  const merged: FougereConfig = { ...base, ...override };
  if (base.fronds || override.fronds) {
    merged.fronds = mergeFrondEntries(base.fronds ?? {}, override.fronds ?? {});
  }

  return merged;
}

/** Load config along the workspace→app frontier. */
export async function loadCascadedConfig(workspaceRoot: string, appRoot: string): Promise<FougereConfig> {
  const base = await loadConfig(workspaceRoot);
  if (resolve(workspaceRoot) === resolve(appRoot)) return base;

  return mergeGlobal(base, await loadConfig(appRoot));
}
