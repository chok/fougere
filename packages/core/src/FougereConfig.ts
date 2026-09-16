import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import type { AuthConfig } from './boot/AuthConfig.js';
import type { LogLevel } from './builtin/LogLevel.js';
import type { ConventionsInput } from './ConventionsInput.js';
import type { NameOf } from './NameOf.js';
import type { PortChoice } from './PortChoice.js';
import { getModuleLoader } from './loader.js';
import type { AdapterConfig } from './AdapterConfig.js';
import { mergeStated, statedFronds, statesModule, type FrondsStated } from './FrondsStated.js';

export interface FougereConfig {
  /** Database configuration — the DEFAULT source, the one an entity lands in unnamed. */
  db?: 'sqlite' | { dialect: 'sqlite'; path?: string } | false;
  /** The other places rows live — a name, an engine, and the entities it holds. */
  sources?: Record<string, { dialect?: 'sqlite'; path?: string; entities: NameOf<'entity'>[] }>;
  /**
   * The names the scan reads instead of deriving them — the import scope, the fronds directory,
   * the seven convention directories.
   */
  conventions?: ConventionsInput;
  /** How much every logger says. */
  logLevel?: LogLevel;
  /**
   * What this app is made of, and who inherits code from whom. The key is a frond name or a
   * module specifier; nesting says only that a child resolves what its parent declared.
   */
  fronds?: FrondsStated;
  /** What answers a port — a name, or the chain from the outside in. */
  ports?: PortChoice;
  /** Auth declaration — picks a provider package and forwards options to it. */
  auth?: AuthConfig;
  /** Which protocol adapters this app serves. */
  adapters?: AdapterConfig;
}

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

/**
 * Where each frond answers — a string leaf of `fronds:`, which is the one place a config says
 * it. `CreateAppOptions.remotes` still takes this shape: the option is what the whole boot
 * reads, and translating here is what keeps it from learning about the tree.
 */
export function remotesOf(config: FougereConfig): Record<string, string> {
  const addresses: Record<string, string> = {};
  for (const stated of statedFronds(config.fronds).fronds) {
    if (stated.value !== undefined && !statesModule(stated.key)) addresses[stated.key] = stated.value;
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
    merged.fronds = mergeStated(base.fronds ?? {}, override.fronds ?? {});
  }

  return merged;
}

/** Load config along the workspace→app frontier. */
export async function loadCascadedConfig(workspaceRoot: string, appRoot: string): Promise<FougereConfig> {
  const base = await loadConfig(workspaceRoot);
  if (resolve(workspaceRoot) === resolve(appRoot)) return base;
  return mergeGlobal(base, await loadConfig(appRoot));
}
