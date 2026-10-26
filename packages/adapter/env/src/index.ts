/** The process environment — `ENTITY_FIELD`, read as the shape says, and never written. */
import { FieldSet, Format, Shapes, type Accepted, type Fields, type SchemaView } from '@fougere/schema';
import { Sources, storageOver, type Source, type Store, type Values } from '@fougere/core';

type Variables = Readonly<Record<string, string | undefined>>;

/** `timeoutMs` → `TIMEOUT_MS`, `catalogConfig` → `CATALOG_CONFIG`. */
function variableOf(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase();
}

function processVariables(): Variables {
  const proc = (globalThis as { process?: { env?: Variables } }).process;

  return proc?.env ?? {};
}

/**
 * Reading an entity off the environment: one variable per field, named `ENTITY_FIELD`, and for
 * rows `ENTITY_KEY_FIELD` read from the END, since the fields are known and the rest is the key.
 *
 * Documented: [values](https://fougere.dev/docs/business/values).
 */
export class Env {
  constructor(private readonly variables: Variables = processVariables()) {}

  /** The value of `name`, its fields read as their shapes say — absent when no variable is set. */
  value(entity: SchemaView, name: string): Values | undefined {
    const fields = entity.getFields();
    const read = Object.entries(fields).flatMap(([field, declared]) => {
      const text = this.variables[this.variable(name, field)];

      return text === undefined ? [] : [[field, Shapes.fromText(declared.shape, text)] as const];
    });

    return read.length > 0 ? Object.fromEntries(read) : undefined;
  }

  /** The variable a field is read from — `MEILI_URL`, or `MEILI_BOOKS_URL` for the row `books`. */
  variable(name: string, field: string, key?: string): string {
    return [variableOf(name), ...(key === undefined ? [] : [key.toUpperCase()]), variableOf(field)].join('_');
  }

  /**
   * What reads every row of `name`, keyed by what sits between the entity and a field — its fields
   * judged when it is made, so two that end alike refuse the boot and not the first read.
   */
  rows(entity: SchemaView, name: string): () => Map<string, Values> {
    const fields = Env.rowFields(entity.getFields(), name);

    return () => this.read(entity, name, fields);
  }

  private read(entity: SchemaView, name: string, fields: (readonly [string, string])[]): Map<string, Values> {
    const primary = FieldSet.of(entity.getFields()).primary;
    const prefix = `${variableOf(name)}_`;
    const rows = new Map<string, Values>();

    for (const [variable, text] of Object.entries(this.variables)) {
      if (text === undefined || !variable.startsWith(prefix)) continue;
      const rest = variable.slice(prefix.length);
      const found = fields.find(([, suffix]) => rest.endsWith(`_${suffix}`));
      if (!found) continue;
      const [field, suffix] = found;
      const key = rest.slice(0, -(suffix.length + 1)).toLowerCase();
      const row = rows.get(key) ?? (primary === undefined ? {} : { [primary]: key });
      row[field] = Shapes.fromText(entity.getFields()[field]!.shape, text);
      rows.set(key, row);
    }

    return rows;
  }

  /**
   * The fields a row variable can end with. Two that end alike — `url` and `booksUrl` — make
   * `MEILI_PROD_BOOKS_URL` two rows at once, so they are refused rather than guessed between.
   */
  private static rowFields(fields: Fields, name: string): (readonly [string, string])[] {
    const primary = FieldSet.of(fields).primary;
    const suffixes = Object.keys(fields).filter((field) => field !== primary).map((field) => [field, variableOf(field)] as const);
    for (const [field, suffix] of suffixes) {
      const longer = suffixes.find(([other, otherSuffix]) => other !== field && otherSuffix.endsWith(`_${suffix}`));
      if (longer) {
        throw new Error(
          `source 'env': ${name}.${longer[0]} ends like ${name}.${field} (${longer[1]}, ${suffix}), so a variable naming `
          + `a row could be read as either. Rename one of them.`,
        );
      }
    }

    // The longest first, so a field never takes the end of another's name.
    return suffixes.sort(([, a], [, b]) => b.length - a.length);
  }
}

/** Nothing here is written: the environment is changed where the process is started. */
function readOnlyStore(env: Env, entity: SchemaView, name: string): Store {
  const rows = env.rows(entity, name);
  const refuse = (key: string) => {
    throw new Error(`source 'env' is read-only: ${name} '${key}' is changed in the environment (${env.variable(name, '*', key)}).`);
  };

  return {
    client: env,
    get: async (key) => rows().get(key),
    has: async (key) => rows().has(key),
    set: async (key) => refuse(key),
    delete: async (key) => refuse(key),
    all: async () => [...rows().values()],
  };
}

export function createEnvSource(variables?: Variables): Source {
  const env = new Env(variables);

  return {
    storageFactory: storageOver((entity, name) => readOnlyStore(env, entity, name)),
    name: 'env',
    value: async (entity, name) => env.value(entity, name),
    valueAt: (entity, name, field) => (field === undefined ? `${variableOf(name)}_*` : env.variable(name, field)),
  };
}

const ENV = Format.of('source/env')
  .key('type', Format.tokens(['env']))
  .needs('type')
  .closed();

declare module '@fougere/core' {
  interface FougereSources {
    env: Accepted<typeof ENV>;
  }
}

Sources.register('env', { format: ENV, readOnly: true, open: () => createEnvSource() });
