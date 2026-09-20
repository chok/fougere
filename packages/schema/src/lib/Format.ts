import type { JsonSchema } from './JsonSchema.js';
import { SchemaError } from '../SchemaError.js';

type Stated = JsonSchema | boolean;

const HERE = 'https://fougere.dev/schema/';

const absolute = (id?: string): string | undefined =>
  id === undefined || id.includes('://') ? id : `${HERE}${id}`;

/** The values a format lets in, as a type — `Accepted<typeof Lifecycle.format>`. */
export type Accepted<F> = F extends Format<infer T> ? T : never;

/**
 * How a format is written here: its keys, never its JSON Schema. `$id`, `$ref`, `$defs` and the
 * closing are produced, and what it accepts is carried as a TYPE, so a declaration is stated once.
 * FR : on écrit les clés d'un format ; le document et le type sont produits.
 * `Format.of('axis/tenancy').key('scope', Format.tokens(SCOPES)).closed()`
 */
export class Format<T = unknown> {
  static readonly anything = new Format<unknown>(true);
  static readonly text = new Format<string>({ type: 'string' });
  static readonly flag = new Format<boolean>({ type: 'boolean' });
  static readonly number = new Format<number>({ type: 'number' });
  static readonly count = new Format<number>({ type: 'integer', minimum: 0 });

  declare readonly _admits?: T;

  protected constructor(
    private readonly stated: Stated,
    readonly id?: string,
  ) {}

  /** `Format.tokens(['now', 'optional'])` → `Instance does not match any of ["now","optional"].` */
  static tokens<const Words extends readonly string[]>(words: Words): Format<Words[number]> {
    return new Format({ enum: [...words] });
  }

  /** `enum`, `required` — a list of one format, so `enum: 'draft'` is refused as the scalar it is. */
  static listOf<Value>(format: Format<Value>): Format<Value[]> {
    return new Format({ type: 'array', items: format.schema });
  }

  /**
   * A format naming ITSELF, which no value can do while it is being built: `items` holds a shape,
   * and the shape is what declares `items`. The `$id` `of()` already posts is what it points at.
   */
  static ref(id: string): Format<unknown> {
    return new Format({ $ref: absolute(id) as string });
  }

  /** A word or a shape, told apart by TYPE, so a refusal names the half the value belongs to. */
  static either<Word, Shape>(word: Format<Word>, shape: Format<Shape>): Format<Word | Shape> {
    return new Format({
      if: { type: 'string' },
      then: word.schema as JsonSchema,
      else: shape.schema as JsonSchema,
    });
  }

  /** One of these keys and no other — `{ value }` or `{ generate }`, never both and never neither. */
  static exactlyOne<Keys extends Record<string, Format<unknown>>>(
    keys: Keys,
  ): Format<{ [K in keyof Keys]: { [P in K]: Accepted<Keys[K]> } }[keyof Keys]> {
    return new Format({
      type: 'object',
      properties: Object.fromEntries(
        Object.entries(keys).map(([key, format]) => [key, format.schema]),
      ),
      propertyNames: { enum: Object.keys(keys) },
      minProperties: 1,
      maxProperties: 1,
    });
  }

  /** A name resolves under this project's own space; another one states its whole `$id`. */
  static of(id?: string): ObjectFormat<object> {
    return new ObjectFormat(absolute(id));
  }

  /** What `of` does for an object, for a format that is not one — `either`, a list of words. */
  static named<Value>(id: string, format: Format<Value>): Format<Value> {
    const named = absolute(id) as string;

    return new Format({ $id: named, ...(format.schema as JsonSchema) }, named);
  }

  /** The type JSON Schema cannot carry: a generator's name, a thunk to an entity. */
  as<Value>(): Format<Value> {
    return this as unknown as Format<Value>;
  }

  get schema(): Stated {
    return this.stated;
  }
}

export class ObjectFormat<T extends object> extends Format<T> {
  private readonly keys = new Map<string, Stated>();
  private readonly cited = new Map<string, JsonSchema>();
  private readonly needed: string[] = [];

  constructor(id?: string) {
    super(true, id);
  }

  key<Name extends string, Value>(
    name: Name,
    format: Format<Value>,
  ): ObjectFormat<T & { [K in Name]?: Value }> {
    this.keys.set(name, format.schema);

    return this as ObjectFormat<T & { [K in Name]?: Value }>;
  }

  /** A key carried whole and pointed at by its `$id`, so it keeps an identity of its own. */
  cites<Name extends string, Value>(
    name: Name,
    format: Format<Value>,
  ): ObjectFormat<T & { [K in Name]?: Value }> {
    if (!format.id) {
      throw new SchemaError(
        `A format cited as '${name}' states no \`$id\`, so nothing can point at it.`,
      );
    }
    this.keys.set(name, { $ref: format.id });
    this.cited.set(name, format.schema as JsonSchema);

    return this as ObjectFormat<T & { [K in Name]?: Value }>;
  }

  needs<Name extends keyof T & string>(
    ...names: Name[]
  ): ObjectFormat<Omit<T, Name> & Required<Pick<T, Name>>> {
    this.needed.push(...names);

    return this as unknown as ObjectFormat<Omit<T, Name> & Required<Pick<T, Name>>>;
  }

  /** These keys and no other: a name nothing states is refused UNDER that name. */
  closed(): Format<{ [K in keyof T]: T[K] }> {
    return new Format(
      {
        ...(this.id ? { $id: this.id } : {}),
        type: 'object',
        properties: Object.fromEntries(this.keys),
        propertyNames: { enum: [...this.keys.keys()] },
        ...(this.needed.length ? { required: [...this.needed] } : {}),
        ...(this.cited.size ? { $defs: Object.fromEntries(this.cited) } : {}),
      },
      this.id,
    );
  }
}
