import { Registry } from '@fougere/registry';
import { JsonSchemaValidator, Role, SchemaError, dotted, type Format, type JsonSchema, type SchemaView } from '@fougere/schema';
import type { StorageFactory } from './storage/StorageFactory.js';
import type { Constraint } from './Constraint.js';
import type { SourceView } from './SourceView.js';

/** Whether an entity asks for one, anywhere but on its key. */
export function declares(schema: SchemaView, constraint: Constraint): boolean {
  const fields = Object.values(schema.getFields());
  if (constraint === 'relation') return fields.some((field) => Role.of(field).isReference());
  if (schema.getUnique().length > 0) return true;

  return fields.some((field) => Role.of(field).isUnique());
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
  /** What `migrate` would create, READ and never written — one line per table or column. */
  pending?(view: SourceView): Promise<string[]>;
  /** Run `fn` as ONE unit of work, with a factory bound to it. */
  transacted?<R>(fn: (factory: StorageFactory) => Promise<R>): Promise<R>;
  /** What it refuses at the rows themselves. Absent leaves the judge alone with it. */
  enforces?: readonly Constraint[];
  close?(): Promise<void>;
  /** What distinguishes it when a query is reported. */
  name?: string;
}

/** A source type: what its entry admits, and how a place is opened from one. */
export interface SourceType<Entry = any> {
  readonly format: Format<Entry>;
  open(entry: Entry): Source;
}

/** Which adapter answers a source type — one per process, no subject to hold. */
class SourceRegistry extends Registry<SourceType> {
  private conventional?: string;

  /** `open` is handed what `format` admitted, so the entry is typed by the format alone. */
  override register<Entry>(name: string, type: SourceType<Entry>): SourceType<Entry> {
    return super.register(name, type) as SourceType<Entry>;
  }

  /** The type an entry naming none is — claimed by the adapter whose format leaves `type` optional. */
  byConvention(name: string): void {
    this.conventional = name;
  }

  /** The place an entry stands for, once its type's format has judged it. */
  open(entry: { type?: string }, path: string): Source {
    const name = entry.type ?? this.conventional;
    if (name === undefined) {
      throw new SchemaError(`${path} needs @fougere/adapter-sql. Add \`import '@fougere/adapter-sql'\` to fougere.config.ts.`);
    }
    const type = this.resolve(name, `${path}.type`);
    const refusal = JsonSchemaValidator.of(type.format.schema as JsonSchema).refusalOf(entry, [path]);
    if (refusal) throw new SchemaError(`${dotted(refusal.path)}: ${refusal.message}`);

    return type.open(entry);
  }
}

export const Sources = new SourceRegistry(
  'source type',
  'import the adapter that answers it, or call Sources.register(name, { format, open })',
);
