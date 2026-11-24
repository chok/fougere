import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parse } from 'yaml';
import { Format, JsonSchemaValidator, SchemaError, dotted, type Accepted, type JsonSchema } from '@fougere/schema';

const PROCESS = Format.of('topology/process')
  .key('url', Format.text)
  .key('fronds', Format.listOf(Format.text))
  .needs('url', 'fronds')
  .closed();

const TOPOLOGY = Format.of('topology')
  .key('processes', Format.recordOf(PROCESS))
  .needs('processes')
  .closed();

/** A process the app reaches: the fronds it runs, and where it answers. */
export interface TopologyProcess {
  name: string;
  url: string;
  fronds: readonly string[];
}

/** What one process runs, and where the fronds it does not run answer. */
export interface Placement {
  /** The fronds this process runs; absent, every one the topology places nowhere else. */
  only?: string[];
  /** Where each frond another process runs answers. */
  remotes: Record<string, string>;
  /** Where this process answers. */
  url?: string;
}

/**
 * The processes the app reaches, read off `fougere.topology.yaml`; the app is every frond they leave.
 *
 * Documented: [processes](https://fougere.dev/docs/concepts/configuration).
 */
export class Topology {
  static readonly FILE = 'fougere.topology.yaml';
  static readonly VARIABLE = 'FOUGERE_PROCESS';
  /** What the file admits — the JSON Schema an editor completes it from. */
  static readonly format = TOPOLOGY;
  private static readonly VARIABLE_REFERENCE = /\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}/g;

  private constructor(readonly processes: readonly TopologyProcess[]) {}

  /** The topology an app reads: the nearest file, from `dir` up. */
  static of(dir: string): Topology {
    for (let at = resolve(dir); ; at = dirname(at)) {
      const path = join(at, Topology.FILE);
      if (existsSync(path)) return Topology.parse(readFileSync(path, 'utf8'));
      if (dirname(at) === at) return new Topology([]);
    }
  }

  /** A topology a host carried, already read — under a runtime with no disk to read it from. */
  static from(processes: readonly TopologyProcess[]): Topology {
    return new Topology(processes);
  }

  /**
   * A topology read from the text of its file, a url naming a variable as Compose does.
   * Ex: `url: ${CATALOG_URL:-binding://CATALOG}`.
   */
  static parse(text: string, environment: Record<string, string | undefined> = process.env): Topology {
    const document: unknown = parse(text) ?? {};
    const refusal = JsonSchemaValidator.of(Topology.format.schema as JsonSchema).refusalOf(document, []);
    if (refusal) throw new SchemaError(`${Topology.FILE}: ${dotted(refusal.path)}: ${refusal.message}`);

    const { processes } = document as Required<Accepted<typeof TOPOLOGY>>;
    const topology = new Topology(Object.entries(processes).map(([name, entry]) => ({
      name,
      url: Topology.interpolated(entry.url, environment),
      fronds: entry.fronds,
    })));
    topology.refuseFrondTwice();

    return topology;
  }

  /** Where each frond the topology places answers. */
  addresses(): Record<string, string> {
    return Object.fromEntries(this.processes.flatMap((one) => one.fronds.map((frond) => [frond, one.url])));
  }

  /** The process `name` designates. */
  process(name: string): TopologyProcess {
    const found = this.processes.find((one) => one.name === name);
    if (found) return found;
    if (this.processes.length === 0) {
      throw new SchemaError(`There is no ${Topology.FILE}, so this project runs as one process — start it without naming '${name}'.`);
    }

    throw new SchemaError(`${Topology.FILE} states no process '${name}'. It states ${this.processes.map((one) => one.name).join(', ')}.`);
  }

  /** What the process `name` runs — `FOUGERE_PROCESS` when unsaid; unnamed, the app. */
  placement(name: string | undefined = process.env[Topology.VARIABLE]): Placement {
    if (name === undefined) return { remotes: this.addresses() };

    const here = this.process(name);
    const remotes = Object.entries(this.addresses()).filter(([frond]) => !here.fronds.includes(frond));

    return { only: [...here.fronds], remotes: Object.fromEntries(remotes), url: here.url };
  }

  private static interpolated(text: string, environment: Record<string, string | undefined>): string {
    return text.replace(Topology.VARIABLE_REFERENCE, (_, name: string, fallback: string | undefined) => {
      const value = environment[name];
      if (value !== undefined && value !== '') return value;
      if (fallback !== undefined) return fallback;
      throw new SchemaError(`${Topology.FILE} reads \${${name}}, which the environment does not set. Set it, or write \${${name}:-<default>}.`);
    });
  }

  private refuseFrondTwice(): void {
    const runBy = new Map<string, string>();
    for (const one of this.processes) {
      for (const frond of one.fronds) {
        const first = runBy.get(frond);
        if (first !== undefined) {
          throw new SchemaError(`${Topology.FILE}: the frond '${frond}' is run by '${first}' and by '${one.name}'. A frond runs in one process.`);
        }
        runBy.set(frond, one.name);
      }
    }
  }
}
