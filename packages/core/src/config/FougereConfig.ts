import { dirname, join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import type { LogLevel } from '../builtin/LogLevel.js';
import type { ConventionsInput } from './ConventionsInput.js';
import type { SourceConfig } from '../extension/SourceConfig.js';
import type { PortChoice } from '../extension/PortChoice.js';
import { getModuleLoader } from '../loader.js';
import type { ProtocolConfig } from '../extension/Protocol.js';
import { statesModule, type FrondEntries } from './FrondEntries.js';
import { keyedFrondEntries } from './KeyedFrondEntry.js';
import { DEFAULT_CONVENTIONS } from './Conventions.js';
import type { StateEntry } from '../extension/FougereStates.js';
import type { ServerConfig } from './ServerConfig.js';

export interface FougereConfig {
  /** Where entities live: a name, a type and its options, then `rows:` and `values:`. */
  sources?: Record<string, SourceConfig>;
  /** The names the scan reads: the import scope, the fronds directory, every convention directory. */
  conventions?: ConventionsInput;
  /** How much every logger says. */
  logLevel?: LogLevel;
  /** How many bytes a caller may send in one call — 2 MiB when unsaid. Consulted at every door. */
  maxBodyBytes?: number;
  /** What this app is made of, keyed by frond name or module specifier. */
  fronds?: FrondEntries;
  /** What answers a port — a name, or the chain from the outside in. */
  ports?: PortChoice;
  /** The protocols this app serves beside its own calls — named here, made available by an import. */
  protocols?: ProtocolConfig;
  /**
   * How each name of the caller's state is kept between requests.
   * Ex: `{ cart: { cookie: { maxAge: 604800 } } }`.
   */
  state?: Record<string, StateEntry>;
  /**
   * The srvx middlewares around what `fougere serve` answers, outside in.
   * Ex: `{ use: [cors()] }`.
   */
  server?: ServerConfig;
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
export function appOptionsFileIn(dir: string): string | undefined {
  return STATEMENT_FILES.map((file) => resolve(dir, file)).find((path) => existsSync(path));
}

/** The project an app belongs to: the nearest directory, from `dir` up, holding the fronds or a config file. */
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

  const mod = await getModuleLoader()(path, fresh ? { fresh } : undefined);

  return ((mod as { default?: FougereConfig }).default ?? mod) as FougereConfig;
}

/** Load the root fougere.config.{ts,js,mjs} from the given directory. */
export async function loadConfig(root: string, options?: { fresh?: boolean }): Promise<FougereConfig> {
  return loadConfigFrom(root, options?.fresh);
}

/** Where each frond answers: the `remote` of its entry in `fronds:`. */
export function remotesOf(config: FougereConfig): Record<string, string> {
  const addresses: Record<string, string> = {};
  for (const entry of keyedFrondEntries(config.fronds)) {
    if (entry.value !== undefined && !statesModule(entry.key)) addresses[entry.key] = entry.value;
  }

  return addresses;
}

/** The config an app reads: the nearest file, from `dir` up. */
export async function loadNearestConfig(dir: string): Promise<FougereConfig> {
  const file = configFileNear(dir);

  return file === undefined ? {} : loadConfig(dirname(file));
}

/** The nearest config file, from `dir` up — what an app reads. */
export function configFileNear(dir: string): string | undefined {
  for (let at = resolve(dir); ; at = dirname(at)) {
    const file = configFileIn(at);
    if (file !== undefined || dirname(at) === at) return file;
  }
}
