import { SchemaError } from '@fougere/schema';
import type { Extension } from '../boot/Extension.js';
import type { NameOf } from '../NameOf.js';

/** A process the apps reach: the fronds it runs, where it answers, and what it carries beside them. */
export interface ProcessEntry {
  url: string;
  fronds: readonly (NameOf<'frond'> | (string & {}))[];
  /** What it carries instead of `platform:`. */
  platform?: readonly Extension[];
}

/** An app of the project, named by its directory under `apps/`. */
export interface AppEntry {
  /** What it carries instead of `platform:`. */
  platform?: readonly Extension[];
}

/** What the config says about where things run. */
export interface TopologyStatement {
  platform?: readonly Extension[];
  apps?: Readonly<Partial<Record<string, AppEntry>>>;
  processes?: Readonly<Record<string, ProcessEntry>>;
}

/** What one process runs, where the fronds it does not run answer, and what it carries. */
export interface ProcessPlacement {
  /** The fronds this process runs; absent, every one `processes:` places nowhere. */
  only?: string[];
  /** Where each frond another process runs answers. */
  remotes: Record<string, string>;
  /** Where this process answers. */
  url?: string;
  /** What this process carries beside its fronds. */
  platform: readonly Extension[];
}

/**
 * Where each frond runs, read off `processes:`; an app runs every frond it places nowhere.
 *
 * Documented: [processes](https://fougere.dev/docs/concepts/configuration).
 */
export class Topology {

  private constructor(private readonly statement: TopologyStatement) {}

  /** The topology a config states. */
  static of(statement: TopologyStatement): Topology {
    const topology = new Topology(statement);
    topology.refuseFrondTwice();

    return topology;
  }

  /** Where each frond `processes:` places answers. */
  addresses(): Record<string, string> {
    return Object.fromEntries(Object.values(this.statement.processes ?? {})
      .flatMap((entry) => entry.fronds.map((frond) => [frond, entry.url])));
  }

  /**
   * What the process `name` runs — or, with no name, the app `app` names.
   * Ex: `placement(undefined, 'web')` is `apps/web`.
   */
  placement(name?: string, app?: string): ProcessPlacement {
    const fallback = this.statement.platform ?? [];
    if (name === undefined) {
      return { remotes: this.addresses(), platform: (app && this.statement.apps?.[app]?.platform) || fallback };
    }

    const here = this.process(name);
    const remotes = Object.entries(this.addresses()).filter(([frond]) => !here.fronds.includes(frond));

    return { only: [...here.fronds], remotes: Object.fromEntries(remotes), url: here.url, platform: here.platform ?? fallback };
  }

  private process(name: string): ProcessEntry {
    const processes = this.statement.processes ?? {};
    const found = processes[name];
    if (found) return found;

    const names = Object.keys(processes);
    if (names.length === 0) {
      throw new SchemaError(`fougere.config.ts states no processes:, so this project runs as one process — start it without naming '${name}'.`);
    }

    throw new SchemaError(`fougere.config.ts states no process '${name}' under processes:. It states ${names.join(', ')}.`);
  }

  private refuseFrondTwice(): void {
    const runBy = new Map<string, string>();
    for (const [name, entry] of Object.entries(this.statement.processes ?? {})) {
      for (const frond of entry.fronds) {
        const first = runBy.get(frond);
        if (first !== undefined) {
          throw new SchemaError(`fougere.config.ts: processes.${name} runs '${frond}', which processes.${first} runs too. A frond runs in one process.`);
        }
        runBy.set(frond, name);
      }
    }
  }
}
