import { Registry, Role, type SchemaView } from '@fougere/schema';
import type { StorageFactory } from './storage/StorageFactory.js';
import type { Constraint } from './Constraint.js';
import type { SourceView } from './SourceView.js';
import type { SourceConfig } from './SourceConfig.js';

/** Whether an entity asks for one, anywhere but on its key. */
export function declares(schema: SchemaView, constraint: Constraint): boolean {
  if (constraint !== 'unique') return false;
  if ((schema.getUnique() ?? []).length > 0) return true;

  return Object.values(schema.getFields()).some((field) => Role.of(field).isUnique);
}

/**
 * A place rows live, whatever realizes it.
 *
 * Documented: [sources](https://fougere.dev/docs/infra/sources).
 */
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
