import { resolve, join } from 'node:path';
import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import type { AuthConfig } from './types.js';
import { getModuleLoader } from './scanner.js';

// ── Types ────────────────────────────────────────

export interface FougereConfig {
  /** Database configuration. */
  db?: 'sqlite' | { dialect: 'sqlite'; path?: string } | false;
  /** Directory containing fronds. Defaults to 'fronds'. */
  frondsDir?: string;
  /** Remote fronds — frondName → base URL. */
  remotes?: Record<string, string>;
  /** Auth declaration — picks a provider package and forwards options to it. */
  auth?: AuthConfig;
}

export interface ResolvedConfig {
  /** Global config merged with all overrides. */
  global: FougereConfig;
  /** Per-frond config overrides. */
  fronds: Record<string, FougereConfig>;
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

/**
 * Load per-frond config files from each frond's directory.
 */
export async function loadFrondConfigs(root: string, frondsDir = 'fronds'): Promise<Record<string, FougereConfig>> {
  const dir = join(root, frondsDir);
  if (!existsSync(dir)) return {};

  const entries = await readdir(dir, { withFileTypes: true });
  const configs: Record<string, FougereConfig> = {};

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const frondConfig = await loadConfigFrom(join(dir, entry.name));
    if (Object.keys(frondConfig).length > 0) {
      configs[entry.name] = frondConfig;
    }
  }

  return configs;
}

// ── Merging ──────────────────────────────────────

/**
 * Override a config with another, the invariant of every cascade level:
 * scalar keys replace, but `remotes` (the topology) MERGES — an override adds
 * or redirects a frond without erasing the others. Used for workspace→app and
 * for global→CLI alike.
 */
export function mergeGlobal(base: FougereConfig, override: Partial<FougereConfig>): FougereConfig {
  const merged: FougereConfig = { ...base, ...override };
  if (base.remotes || override.remotes) {
    merged.remotes = { ...base.remotes, ...override.remotes };
  }
  return merged;
}

/**
 * Merge configs with cascade: global → frond → CLI overrides.
 *
 * Returns a ResolvedConfig with the merged global and per-frond overrides.
 */
export function mergeConfig(
  global: FougereConfig,
  frondConfigs: Record<string, FougereConfig>,
  cliOverrides: Partial<FougereConfig> = {},
): ResolvedConfig {
  return { global: mergeGlobal(global, cliOverrides), fronds: frondConfigs };
}

/**
 * Get the effective config for a specific frond.
 * Cascade: global → frond override.
 */
export function configForFrond(resolved: ResolvedConfig, frondName: string): FougereConfig {
  const frondOverride = resolved.fronds[frondName];
  if (!frondOverride) return resolved.global;
  return { ...resolved.global, ...frondOverride };
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

/**
 * Load everything: root config + frond configs + merge with CLI overrides.
 */
export async function resolveConfig(
  root: string,
  cliOverrides: Partial<FougereConfig> = {},
): Promise<ResolvedConfig> {
  const global = await loadConfig(root);
  const frondsDir = cliOverrides.frondsDir ?? global.frondsDir ?? 'fronds';
  const frondConfigs = await loadFrondConfigs(root, frondsDir);
  return mergeConfig(global, frondConfigs, cliOverrides);
}
