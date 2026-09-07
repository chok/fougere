import { Registry, Role, type SchemaView } from '@fougere/schema';
import type { StorageFactory } from './storage.js';

/** A promise the judge at the door cannot keep, because it is about rows it never sees. */
export type Constraint = 'unique';

/** Whether an entity asks for one, anywhere but on its key. */
export function declares(schema: SchemaView, constraint: Constraint): boolean {
  if (constraint !== 'unique') return false;
  if ((schema.getUnique() ?? []).length > 0) return true;

  return Object.values(schema.getFields()).some((field) => Role.of(field).isUnique);
}

/** A place rows live, whatever realizes it. */
export interface Source {
  storageFactory: StorageFactory;
  /**
   * Bring the shape of what lives here up to date, and say what it could not bring.
   *
   * A pass is additive by design and leaves what already exists alone — which is a
   * promise worth keeping and a silence worth breaking: what it declined to change is
   * still a difference, and a boot is where a reader can act on it.
   */
  migrate?(view: SourceView): Promise<void | string>;
  /** Run `fn` as ONE unit of work, with a factory bound to it. */
  transacted?<R>(fn: (factory: StorageFactory) => Promise<R>): Promise<R>;
  /** What it refuses at the rows themselves. Absent leaves the judge alone with it. */
  enforces?: readonly Constraint[];
  close?(): Promise<void>;
  /** What distinguishes it when a query is reported. */
  name?: string;
}

/** The app as ONE source sees it. */
export interface SourceView {
  fronds: readonly { readonly name: string; readonly entities: readonly { readonly name: string }[] }[];
  /** The auth provider's own entities, when they ride with this source. */
  auth?: unknown;
  elsewhere: readonly string[];
}

/** What a config file can carry about a source — values, never a live driver. */
export interface SourceConfig {
  /** The adapter that realizes it. Absent means the conventional one. */
  source?: string;
  /** The entities whose rows live here. Absent on the default source: it holds the rest. */
  entities?: string[];
  [key: string]: unknown;
}

/** Which adapter answers a source name — one per process, no subject to hold. */
class SourceRegistry extends Registry<(conf: SourceConfig) => Source> {
  /** The source this name stands for, built from the config entry that named it. */
  open(name: string, conf: SourceConfig, path?: string): Source {
    return this.resolve(name, path)(conf);
  }
}

export const Sources = new SourceRegistry(
  'source',
  'import the adapter that answers it, or call Sources.register(name, build)',
);
