import type { JsonSchema } from './JsonSchema.js';
import { SchemaError } from '../SchemaError.js';

type Stated = JsonSchema | boolean;

const HERE = 'https://fougere.dev/schema/';

const absolute = (id?: string): string | undefined =>
  id === undefined || id.includes('://') ? id : `${HERE}${id}`;

/**
 * How a format is written here: its keys, never its JSON Schema. `$id`, `$ref`, `$defs` and
 * the closing are produced, so an axis states what it admits and nothing about the document.
 * FR : on écrit les clés d'un format, jamais son JSON Schema — le document est produit.
 * `Format.of('axis/tenancy').key('scope', Format.tokens(SCOPES)).closed()`
 */
export class Format {
  static readonly anything = new Format(true);
  static readonly text = new Format({ type: 'string' });
  static readonly flag = new Format({ type: 'boolean' });

  protected constructor(
    private readonly stated: Stated,
    readonly id?: string,
  ) {}

  /** `Format.tokens(['now', 'optional'])` → `Instance does not match any of ["now","optional"].` */
  static tokens(tokens: readonly string[]): Format {
    return new Format({ enum: [...tokens] });
  }

  /** A word or a shape, told apart by TYPE, so a refusal names the half the value belongs to. */
  static either(word: Format, shape: Format): Format {
    return new Format({
      if: { type: 'string' },
      then: word.schema as JsonSchema,
      else: shape.schema as JsonSchema,
    });
  }

  /** One of these keys and no other — `{ value }` or `{ generate }`, never both and never neither. */
  static exactlyOne(keys: Record<string, Format>): Format {
    return new Format({
      type: 'object',
      properties: Object.fromEntries(Object.entries(keys).map(([key, format]) => [key, format.schema])),
      propertyNames: { enum: Object.keys(keys) },
      minProperties: 1,
      maxProperties: 1,
    });
  }

  /** A name resolves under this project's own space; another one states its whole `$id`. */
  static of(id?: string): ObjectFormat {
    return new ObjectFormat(absolute(id));
  }

  /** What `of` does for an object, for a format that is not one — `either`, a list of words. */
  static named(id: string, format: Format): Format {
    const named = absolute(id) as string;

    return new Format({ $id: named, ...(format.schema as JsonSchema) }, named);
  }

  get schema(): Stated {
    return this.stated;
  }
}

export class ObjectFormat extends Format {
  private readonly keys = new Map<string, Stated>();
  private readonly cited = new Map<string, JsonSchema>();
  private readonly needed: string[] = [];

  constructor(id?: string) {
    super(true, id);
  }

  key(name: string, format: Format): this {
    this.keys.set(name, format.schema);

    return this;
  }

  /** A key carried whole and pointed at by its `$id`, so it keeps an identity of its own. */
  cites(name: string, format: Format): this {
    if (!format.id) {
      throw new SchemaError(`A format cited as '${name}' states no \`$id\`, so nothing can point at it.`);
    }
    this.keys.set(name, { $ref: format.id });
    this.cited.set(name, format.schema as JsonSchema);

    return this;
  }

  needs(...names: string[]): this {
    this.needed.push(...names);

    return this;
  }

  /** These keys and no other: a name nothing states is refused UNDER that name. */
  closed(): Format {
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
