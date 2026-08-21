import { Role } from '@fougere/schema';
/**
 * @fougere/adapter-graphql — Pothos types derived from Fougere entities
 */
import type SchemaBuilder from '@pothos/core';
import { Anatomy, Schema, type Shape } from '@fougere/schema';
import type { Field, Fields, SchemaView, SchemaSource } from '@fougere/schema';
import { Boundary, Lifecycle, fieldsOf, inputFields, sourceNameOf } from '@fougere/schema';

// ─── Types ─────────────────────────────────────────

type EntityClass = SchemaView & (abstract new (...args: any[]) => any);

/** Presenter instance — each method is a computed field resolver. */
type PresenterInstance = Record<string, (parent: any) => any>;

export interface TypeConfig {
  /** Nom du type GraphQL */
  name: string;
  /** Entity source */
  /** The schema whose fields become the type — a live class, or a card that travelled. */
  entity: SchemaSource;
  /** Champs à exclure du type GraphQL */
  exclude?: string[];
  /** Relations à résoudre */
  relations?: Record<string, RelationConfig>;
  /** Presenter instance — adds computed fields as resolveFields on this type. */
  presenter?: PresenterInstance;
  /** Presenter field names (methods to expose). If absent, all methods are exposed. */
  presenterFields?: string[];
  /** Per-field type metadata from source parsing. */
  presenterFieldMeta?: { name: string; returnType?: string; list?: boolean; nullable?: boolean }[];
  /**
   * The view a computed field emits, when the presenter declared one — the object type
   * to build for it. Without a declaration the scan reads a scalar or nothing, and an
   * object-valued field can only be serialized.
   */
  presenterViews?: Record<string, EntityClass | [EntityClass]>;
  /** Builds (or reuses) the GraphQL object type for a declared view. */
  viewType?: (view: EntityClass, fieldName: string) => any;
}

export interface RelationConfig {
  /** Type GraphQL cible (retourné par registerType) */
  type: any;
  /** Est-ce une liste ? */
  list?: boolean;
  /** Résolveur personnalisé */
  resolve: (parent: any) => any;
}

export interface InputConfig {
  /** The GraphQL type name. */
  name: string;
  /** The view to project — derive it (`pick`/`omit`/`partial`) before handing it over. */
  schema: SchemaView;
}

/** Parsed method signature (mirrors core OperationMeta.signature). */
interface ParsedSignature {
  name: string;
  params: { name: string; type: { raw: string; name: string; array?: boolean; nullable?: boolean; generics?: ParsedSignature['params'][0]['type'][] }; optional?: boolean }[];
  returnType?: { raw: string; name: string; array?: boolean; nullable?: boolean; generics?: ParsedSignature['params'][0]['type'][] };
}

/** Metadata for a handler operation (from scanner). */
interface OperationMeta {
  input?: SchemaView;
  output?: SchemaView;
  signature?: ParsedSignature;
  /**
   * The operation in words. It reaches here already — `handler.operations` is core's
   * `Map<string, OperationContract>`, and this narrowed view simply did not name the
   * field, so an explorer showed every field undocumented while the sentence sat one
   * property away.
   */
  description?: string;
}

export interface OperationsConfig {
  /** Entity name (PascalCase). */
  name: string;
  /** GraphQL entity type ref (from registerType). */
  type: any;
  /** Handler facade — each op receives InvocationContext. */
  facade: Record<string, Function>;
  /** Operations metadata from scanner (signature + resolved schemas). */
  operations: Map<string, OperationMeta>;
  /** Per-op kind overrides from frond.config.ts (optional). */
  operationsOverrides?: Record<string, { kind?: 'query' | 'command'; graphql?: string }>;
  /**
   * Who is registering — `catalog/ChapterHandler`, for the message when two ops claim
   * one root field. Absent when a caller builds a type by hand.
   */
  origin?: string;
  /**
   * The GraphQL type for a schema an operation declares as its return. The caller owns
   * this because it alone knows whether the schema IS the entity's (then: the type
   * already registered) or something else (then: a new named type).
   */
  viewType?: (view: SchemaView, opName: string) => any;
}

// Mirrors core's resolveIsReadOp (this package stays core-free, same as OperationMeta
// above). Scheduled to die with the handler-kind plan (docs/notes/handler-kind.md).
const READ_PREFIXES = ['list', 'find', 'get', 'search', 'count', 'exists', 'stats'];
function resolveIsReadOp(
  name: string,
  overrides?: Record<string, { kind?: 'query' | 'command' }>,
): boolean {
  const kind = overrides?.[name]?.kind;
  if (kind) return kind === 'query';
  return READ_PREFIXES.some((p) => name.startsWith(p));
}

function capitalize(s: string): string {
  return s[0].toUpperCase() + s.slice(1);
}

function pluralize(name: string): string {
  return name.endsWith('y') ? name.slice(0, -1) + 'ies' : name + 's';
}

const PRIMITIVES: Record<string, (t: any, required: boolean) => any> = {
  string: (t, r) => t.arg.string({ required: r }),
  number: (t, r) => t.arg.int({ required: r }),
  boolean: (t, r) => t.arg.boolean({ required: r }),
};

/**
 * Parameter types no GraphQL argument stands for. `ListOptions` is NOT one of
 * them: it has its own branch below that turns it into the six pagination
 * arguments. Listing it here classified it first — the skip branch runs before
 * the pagination one — so `kind: 'pagination'` was never assigned and every
 * `list(options?: ListOptions)` op reached GraphQL with no arguments at all.
 */
const SKIP_TYPES = new Set(['InvocationContext']);

// ─── Helpers ───────────────────────────────────────

function fieldToGraphQL(
  t: any,
  field: Field,
  fieldName: string,
  enumFor?: (values: string[]) => any | undefined,
): any {
  // Dispatch on the BASE type via anatomy — `shape.type` may be the nullable
  // `[T,'null']` union, a direct comparison would fail silently on it.
  const { base: shape, nullable } = Anatomy.of(field.shape);

  // Before the type switch: a bounded set is its own GraphQL type whatever its base type
  // carries. `oneOf` fed the form's `select` and the DDL's `CHECK` from the day it was
  // written; here it fell through to `String`, so a schema explorer showed nothing of the
  // set and a generated client could not narrow the union.
  // Only the TYPE changes here. `nullable` is passed exactly where the `String` branch below
  // passes it and omitted where that branch calls `exposeString` — spelling `nullable: false`
  // instead would emit `PostStatus!` next to a `title: String` on the same type, so a bounded
  // set would carry a stricter contract than a plain field for no reason of its own.
  const values = enumFor && enumValuesOf(shape);
  if (values) {
    const ref = enumFor(values);
    if (ref) {
      const resolve = (parent: any) => parent[fieldName] ?? null;
      return nullable ? t.field({ type: ref, nullable: true, resolve }) : t.field({ type: ref, resolve });
    }
  }

  switch (shape?.type) {
    case 'integer':
      return nullable ? t.int({ nullable: true, resolve: (parent: any) => parent[fieldName] ?? null })
                      : t.exposeInt(fieldName);

    case 'number':
      return nullable ? t.float({ nullable: true, resolve: (parent: any) => parent[fieldName] ?? null })
                      : t.exposeFloat(fieldName);

    case 'boolean':
      return nullable ? t.boolean({ nullable: true, resolve: (parent: any) => parent[fieldName] ?? null })
                      : t.exposeBoolean(fieldName);

    case 'object':
      // JSON → String sérialisé
      return t.string({
        nullable,
        resolve: (parent: any) => {
          const val = parent[fieldName];
          return val != null ? JSON.stringify(val) : null;
        },
      });

    case 'array': {
      // A value list (`list(text())`) becomes a GraphQL list of the item scalar; a list
      // of objects becomes a list of JSON strings — the same rule 'object' follows.
      const items = Anatomy.of(shape.items).base;
      const resolve = (parent: any) => parent[fieldName] ?? (nullable ? null : []);
      switch (items?.type) {
        case 'integer': return t.intList({ nullable, resolve });
        case 'number': return t.floatList({ nullable, resolve });
        case 'boolean': return t.booleanList({ nullable, resolve });
        case 'object':
          return t.stringList({
            nullable,
            resolve: (parent: any) => {
              const val = parent[fieldName];
              return val != null ? val.map((v: unknown) => JSON.stringify(v)) : (nullable ? null : []);
            },
          });
        default: return t.stringList({ nullable, resolve });
      }
    }

    case 'string':
      // date-time → String GraphQL, encoded on egress via the field's boundary (Date → ISO).
      // Exposing the raw Date would let Pothos coerce it to a non-ISO `String(date)`.
      if (shape.format === 'date-time') {
        return t.string({
          nullable,
          resolve: (parent: any) => {
            const val = parent[fieldName];
            return val != null ? Boundary.of(field).encode(val) : null;
          },
        });
      }
      // string (id, texte, enum, ref) → String GraphQL
      return nullable ? t.string({ nullable: true, resolve: (parent: any) => parent[fieldName] ?? null })
                      : t.exposeString(fieldName);

    default:
      // pas de shape (relation many) → String GraphQL
      return nullable ? t.string({ nullable: true, resolve: (parent: any) => parent[fieldName] ?? null })
                      : t.exposeString(fieldName);
  }
}

/**
 * A JSON-Schema object shape, turned into a GraphQL input type.
 *
 * `list(json(OrderLine))` inlines the line's shape as nested `properties` — good enough for
 * the judge, invisible to GraphQL until now: the `array` case fell through to `stringList`,
 * so `items` reached the schema as `[String!]!` and a client had to hand-encode every line
 * as JSON. The mutation was unusable (measured 2026-08-02).
 */
function nestedInputType(
  builder: InstanceType<typeof SchemaBuilder>,
  shape: Shape,
  name: string,
): any {
  let perBuilder = nestedInputs.get(builder as object);
  if (!perBuilder) nestedInputs.set(builder as object, (perBuilder = new Map()));
  const known = perBuilder.get(name);
  if (known) return known;

  // Only an object shape has these two, and only an object shape reaches here.
  const properties: Record<string, Shape> = 'properties' in shape ? (shape.properties ?? {}) as Record<string, Shape> : {};
  const required = new Set<string>('required' in shape ? shape.required ?? [] : []);
  const type = (builder as any).inputType(name, {
    fields: (t: any) => {
      const out: Record<string, any> = {};
      for (const [key, prop] of Object.entries(properties)) {
        const isRequired = required.has(key);
        switch (Anatomy.of(prop).base?.type) {
          case 'integer': out[key] = t.int({ required: isRequired }); break;
          case 'number': out[key] = t.float({ required: isRequired }); break;
          case 'boolean': out[key] = t.boolean({ required: isRequired }); break;
          default: out[key] = t.string({ required: isRequired }); break;
        }
      }
      return out;
    },
  });
  perBuilder.set(name, type);
  return type;
}

/**
 * One input type per name, PER BUILDER — Pothos refuses a duplicate name, and a ref built on
 * one builder is unknown to the next: a global cache handed a stale ref to the second schema
 * ("InputObjectRef has not been implemented"). The builder owns its types, so it owns the map.
 */
const nestedInputs = new WeakMap<object, Map<string, any>>();

/** Same rule as {@link nestedInputs}, for the enum types — with the values, see below. */
const enumTypes = new WeakMap<object, Map<string, { ref: any; values: string[] }>>();

/**
 * A GraphQL enum value is an IDENTIFIER, not a string: `in-progress` or `à valider` cannot
 * be spelled in a query. `oneOf` is a JSON Schema keyword and accepts any string, so a set
 * that will not fit stays a `String` — the judge still refuses what is not in it.
 */
const GRAPHQL_NAME = /^[_A-Za-z][_0-9A-Za-z]*$/;

function enumValuesOf(shape: Shape | undefined): string[] | undefined {
  const values = shape && 'enum' in shape ? shape.enum : undefined;
  if (!Array.isArray(values) || values.length === 0) return undefined;
  if (!values.every((v) => typeof v === 'string' && GRAPHQL_NAME.test(v))) return undefined;
  return values as string[];
}

/**
 * The enum type for one field's value set — one per NAME per builder, so `Post.status` and
 * `CreatePostInput.status` are the same `PostStatus` and a value read can be written back.
 *
 * A second field claiming the name with a different set falls back to `String` rather than
 * being served the first one: two different sets under one name would let a client send a
 * value this field never declared, which is the opposite of what the enum is for.
 */
function enumTypeFor(
  builder: InstanceType<typeof SchemaBuilder>,
  name: string,
  values: string[],
): any | undefined {
  let perBuilder = enumTypes.get(builder as object);
  if (!perBuilder) enumTypes.set(builder as object, (perBuilder = new Map()));

  const known = perBuilder.get(name);
  if (known) {
    const same = known.values.length === values.length && known.values.every((v, i) => v === values[i]);
    return same ? known.ref : undefined;
  }

  const ref = (builder as any).enumType(name, { values });
  perBuilder.set(name, { ref, values });
  return ref;
}

/** `Post` + `status` → `PostStatus`. Undefined when the schema has no name to build on. */
function enumNameFor(owner: string | undefined, fieldName: string): string | undefined {
  return owner ? `${owner}${capitalize(fieldName)}` : undefined;
}

function fieldToInput(
  t: any,
  field: Field,
  patch: boolean,
  nested?: (shape: Shape, suffix: string) => any,
  enumFor?: (values: string[]) => any | undefined,
): any {
  // Required = the presence axis, projected onto GraphQL's single knob: the
  // caller must supply it (no `lifecycle.create` rule answers absence), null is
  // not legal, and the view is not in patch mode (a patch omits freely).
  const { base: shape, nullable } = Anatomy.of(field.shape);
  const required = !patch && !nullable && Lifecycle.of(field).requiredAtCreate;

  // The dual of the output side, and it must be the SAME type: an input left as `String`
  // would refuse nothing the enum refuses, and a client could not hand back the value a
  // query just gave it.
  const values = enumFor && enumValuesOf(shape);
  if (values) {
    const ref = enumFor(values);
    if (ref) return t.field({ type: ref, required });
  }

  switch (shape?.type) {
    case 'integer':
      return t.int({ required });

    case 'number':
      return t.float({ required });

    case 'boolean':
      return t.boolean({ required });

    case 'array': {
      const items = Anatomy.of(shape.items).base;
      switch (items?.type) {
        case 'integer': return t.intList({ required });
        case 'number': return t.floatList({ required });
        case 'boolean': return t.booleanList({ required });
        case 'object': {
          // A nested shape IS a type — serializing it would make the caller encode JSON by hand.
          const built = nested?.(items, 'Item');
          return built ? t.field({ type: [built], required }) : t.stringList({ required });
        }
        default: return t.stringList({ required });
      }
    }

    case 'string':
    case 'object':
    default:
      return t.string({ required });
  }
}

// ─── Scalars ──────────────────────────────────────

type ScalarName = 'string' | 'int' | 'float' | 'boolean';

const SCALARS: Record<ScalarName, (t: any, opts: any) => any> = {
  string:  (t, o) => o.nullable ? t.string(o)  : t.string(o),
  int:     (t, o) => o.nullable ? t.int(o)     : t.int(o),
  float:   (t, o) => o.nullable ? t.float(o)   : t.float(o),
  boolean: (t, o) => o.nullable ? t.boolean(o) : t.boolean(o),
};

function isScalar(type: unknown): type is ScalarName {
  return typeof type === 'string' && type in SCALARS;
}

// ─── registerObjectType ───────────────────────────

/** Declarative field definition for registerObjectType. */
export interface ObjectFieldDef {
  /** Scalar name ('string', 'int', 'float', 'boolean') or Pothos type ref. Use [ref] for lists. */
  type: ScalarName | any;
  nullable?: boolean;
  /** Custom resolver. Defaults to `(parent) => parent[fieldName]`. */
  resolve?: (parent: any) => any;
}

/**
 * Register a GraphQL object type from a declarative field map.
 *
 * Each field auto-resolves from `parent[key]` unless a custom `resolve` is provided.
 * Works for wrapper types, result types, or any structural type.
 *
 * ```ts
 * const PostList = registerObjectType(builder, 'PostList', {
 *   items:     { type: [PostType] },
 *   total:     { type: 'int', nullable: true, resolve: async (p) => lazyCount(p) },
 *   hasMore:   { type: 'boolean', nullable: true },
 *   endCursor: { type: 'string', nullable: true },
 * });
 * ```
 */
export function registerObjectType(
  builder: InstanceType<typeof SchemaBuilder>,
  name: string,
  fieldDefs: Record<string, ObjectFieldDef>,
): any {
  return (builder as any).objectRef(name).implement({
    fields: (t: any) => {
      const result: Record<string, any> = {};
      for (const [key, def] of Object.entries(fieldDefs)) {
        const nullable = def.nullable ?? false;

        // Custom resolve → field resolver (lazy/computed fields)
        if (def.resolve) {
          if (Array.isArray(def.type)) {
            result[key] = t.field({ type: def.type, nullable, resolve: def.resolve });
          } else if (isScalar(def.type)) {
            result[key] = SCALARS[def.type](t, { nullable, resolve: def.resolve });
          } else {
            result[key] = t.field({ type: def.type, nullable, resolve: def.resolve });
          }
          continue;
        }

        // No custom resolve → expose directly from parent (no resolveField overhead)
        if (isScalar(def.type)) {
          const expose = {
            string:  () => t.exposeString(key, { nullable }),
            int:     () => t.exposeInt(key, { nullable }),
            float:   () => t.exposeFloat(key, { nullable }),
            boolean: () => t.exposeBoolean(key, { nullable }),
          };
          result[key] = expose[def.type]();
        } else if (Array.isArray(def.type)) {
          result[key] = t.field({ type: def.type, nullable, resolve: (parent: any) => parent[key] });
        } else {
          result[key] = t.field({ type: def.type, nullable, resolve: (parent: any) => parent[key] });
        }
      }
      return result;
    },
  });
}

// ─── Public API ────────────────────────────────────

/**
 * Enregistre un type GraphQL (lecture) depuis une entité fougere.
 *
 * ```ts
 * const ProductType = registerType(builder, {
 *   name: 'Product',
 *   entity: Product,
 *   exclude: ['categoryId'],
 *   relations: {
 *     category: {
 *       type: CategoryType,
 *       resolve: (parent) => db.select()...
 *     },
 *   },
 * });
 * ```
 */
export function registerType(builder: InstanceType<typeof SchemaBuilder>, config: TypeConfig): any {
  // A live class or a card — an adapter needs the fields, never the constructor.
  const fields = fieldsOf(config.entity);
  const exclude = new Set(config.exclude ?? []);
  // Who owns the enum names: the schema a view came from, so `PostCard.status` and
  // `CreatePostInput.status` land on the one `PostStatus`. A card that travelled carries no
  // class name — the GraphQL type name is then the best owner available.
  const enumOwner = sourceNameOf(config.entity as SchemaView) ?? config.name;

  return (builder as any).objectRef(config.name).implement({
    fields: (t: any) => {
      const result: Record<string, any> = {};

      for (const [fieldName, field] of Object.entries(fields)) {
        if (exclude.has(fieldName)) continue;
        // Skip 'many' fields — handled by relations
        if (Role.of(field).isCollection) continue;
        // Skip fields that have a relation override
        if (config.relations?.[fieldName]) continue;
        // Write-only (boundary out: 'closed', e.g. password): never emitted
        if (Boundary.of(field).writeOnly) continue;

        result[fieldName] = fieldToGraphQL(t, field, fieldName, (values) => {
          const name = enumNameFor(enumOwner, fieldName);
          return name ? enumTypeFor(builder, name, values) : undefined;
        });
      }

      // Add relations
      if (config.relations) {
        for (const [name, rel] of Object.entries(config.relations)) {
          if (rel.list) {
            result[name] = t.field({
              type: [rel.type],
              resolve: rel.resolve,
            });
          } else {
            result[name] = t.field({
              type: rel.type,
              resolve: rel.resolve,
            });
          }
        }
      }

      // Add presenter computed fields (resolveField — called only when requested)
      if (config.presenter) {
        const allowed = config.presenterFields
          ? new Set(config.presenterFields)
          : null;
        const metaMap = new Map(
          (config.presenterFieldMeta ?? []).map((m) => [m.name, m]),
        );
        // The names the scan found, looked up on the instance — never `Object.entries`.
        // A presenter is a class instance: its methods live on the prototype, so own
        // enumerable properties are its INJECTED DEPENDENCIES and nothing else. Enumerating
        // them added no computed field at all and would have exposed the ORMs if any name
        // had matched — an Order reached GraphQL with neither user, items nor total, while
        // REST carried all three from the same presenter.
        const names = config.presenterFields ?? Object.getOwnPropertyNames(
          Object.getPrototypeOf(config.presenter),
        );
        for (const name of names) {
          if (name === 'constructor') continue;
          if (allowed && !allowed.has(name)) continue;
          if (result[name]) continue; // entity field takes precedence
          const fn = (config.presenter as Record<string, unknown>)[name];
          if (typeof fn !== 'function') continue;

          const meta = metaMap.get(name);
          const nullable = meta?.nullable ?? true;
          // READ the value, never recompute it. The façade applies the presenter on every
          // door (`presentEgress`), so the row arrives carrying its computed fields; calling
          // the method again ran the work twice — and once the method started receiving the
          // PAGE rather than one row, the second call was handed a single object and threw
          // `posts.map is not a function`. What GraphQL owes the field is its declaration.
          const resolve = (parent: any) => parent?.[name] ?? null;

          // The presenter STATED what this field emits — build its type instead of guessing.
          const declared = config.presenterViews?.[name];
          if (declared && config.viewType) {
            const isList = Array.isArray(declared);
            const view = (isList ? declared[0] : declared) as EntityClass;
            const viewRef = config.viewType(view, name);
            result[name] = t.field({ type: isList ? [viewRef] : viewRef, nullable, resolve });
            continue;
          }

          // Map inferred return type → GraphQL scalar, one per row or a list of them.
          // `list` is the arity the scan measured after removing the page level of the
          // method's return type; without it a computed list announced its item type and
          // a client selecting the field got one value where the row carried several.
          const many = meta?.list === true;
          switch (meta?.returnType) {
            case 'number':
              result[name] = many ? t.floatList({ nullable, resolve }) : t.float({ nullable, resolve });
              break;
            case 'boolean':
              result[name] = many ? t.booleanList({ nullable, resolve }) : t.boolean({ nullable, resolve });
              break;
            case 'string':
              result[name] = many ? t.stringList({ nullable, resolve }) : t.string({ nullable, resolve });
              break;
            default:
              // The scan could not name a scalar: the method returns an object, a list, or
              // nothing it can read. Serialize, exactly as an `object`-shaped entity field
              // does — a String typing without serialization made GraphQL coerce the value
              // to "[object Object]", and any client selecting subfields got a schema error
              // on a field that REST served whole.
              result[name] = t.string({
                nullable,
                resolve: async (parent: any) => {
                  const value = await resolve(parent);
                  if (value == null) return null;
                  return typeof value === 'string' ? value : JSON.stringify(value);
                },
              });
              break;
          }
        }
      }

      return result;
    },
  });
}

/**
 * The GraphQL input for EXACTLY this view — or none, when the view asks for nothing.
 *
 * The caller derives the view and this projects it; it holds no policy of its own. What
 * a client may supply at CREATION is `inputFields`, which the op path applies for
 * create/update alone — `publish(input: Post)` must still name the post.
 *
 * Two things are dropped here because GraphQL cannot carry them, not because of any
 * rule: a collection has no column to send, and `boundary in: 'closed'` is refused from
 * every client. A view left with nothing after that gets `undefined` rather than an
 * input object with zero fields, which is invalid GraphQL and takes the WHOLE schema
 * down — every other type included.
 *
 * ```ts
 * const CreateProductInput = registerInput(builder, {
 *   name: 'CreateProductInput',
 *   schema: CreateProduct,
 * });
 * ```
 */
export function registerInput(builder: InstanceType<typeof SchemaBuilder>, config: InputConfig): any {
  const fields = Object.fromEntries(
    Object.entries(config.schema.getFields())
      .filter(([, field]) => !Role.of(field).isCollection && !Boundary.of(field).readOnly),
  );
  if (Object.keys(fields).length === 0) return undefined;
  // The view's SOURCE, not the input's name: `CreatePostInput` derives from `Post`, and its
  // `status` must be the same `PostStatus` the query emits.
  const enumOwner = sourceNameOf(config.schema);
  // Input-field omissibility is a projection of the view's MODE (partial() → patch),
  // never of forged per-field flags — the fields themselves stay untouched.
  const patch = config.schema.getOpts().patch ?? false;

  return (builder as any).inputType(config.name, {
    fields: (t: any) => {
      const result: Record<string, any> = {};

      for (const [fieldName, field] of Object.entries(fields)) {
        result[fieldName] = fieldToInput(
          t, field, patch,
          (shape, suffix) => nestedInputType(builder, shape, `${config.name}${capitalize(fieldName)}${suffix}`),
          (values) => {
            const name = enumNameFor(enumOwner, fieldName);
            return name ? enumTypeFor(builder, name, values) : undefined;
          },
        );
      }

      return result;
    },
  });
}

// ─── GraphQL field naming ────────────────────────

/**
 * Who holds each root field — a GraphQL root is FLAT, and two ops can want one name.
 *
 * Refused here rather than left to Pothos: it answers `Duplicate field ofBook on
 * Mutation` with no file, no handler and no remedy, and it takes the whole schema down
 * — every other type included. The five CRUD names weave the entity in (`createBook`),
 * so they never meet this; a custom op keeps its method name, which is the author's and
 * says nothing about its subject. Four handlers named `ofBook` in one measured app.
 *
 * Nothing is renamed automatically: `chapterOfBook` would be this package's choice of
 * the app's public vocabulary, and adding an entity in some other frond would silently
 * rename a field already published.
 */
const claimed = new WeakMap<object, Map<string, string>>();
function claimRootField(builder: object, fieldName: string, origin: string): void {
  let held = claimed.get(builder);
  if (!held) { held = new Map(); claimed.set(builder, held); }

  const first = held.get(fieldName);
  if (first !== undefined && first !== origin) {
    const opName = origin.split('.').pop();
    // `operations:` is keyed by op name PER FROND, so it cannot tell two handlers of the
    // same frond apart. Saying otherwise would send the author to a fix that cannot work.
    const remedy = first.split('/')[0] === origin.split('/')[0]
      ? `Both are in the same frond, where \`operations:\` is keyed by op name and cannot `
        + `tell them apart — rename one of the methods.`
      : `Rename one of the methods, or name the field in the frond.config.ts of whichever `
        + `should yield:\n  operations: { ${opName}: { graphql: '…' } }`;
    throw new Error(
      `two operations claim the GraphQL root field \`${fieldName}\`:\n`
      + `  ${first}\n  ${origin}\n`
      + `A root field is global, so one of them has to give. ${remedy}`,
    );
  }
  held.set(fieldName, origin);
}

function graphqlFieldName(opName: string, entityName: string): string {
  const nameLower = entityName.charAt(0).toLowerCase() + entityName.slice(1);
  const namePlural = pluralize(nameLower);

  switch (opName) {
    case 'list': return namePlural;
    case 'findById': return nameLower;
    case 'create':
    case 'update':
    case 'delete':
      return `${opName}${entityName}`;
    default:
      return opName;
  }
}

// ─── Args building from parsed signatures ────────

interface ArgsResult {
  argsDef: (t: any) => Record<string, any>;
  buildInvocation: (args: any, gqlCtx: any) => { params: Record<string, any>; query: Record<string, any>; body: unknown; state: Record<string, any> };
}

function buildArgsFromSignature(
  sig: ParsedSignature,
  meta: OperationMeta,
  builder: InstanceType<typeof SchemaBuilder>,
  opName: string,
  entityName: string,
): ArgsResult {
  // Classify each param: primitive, body (object/input), or skip
  const paramPlan: { name: string; kind: 'primitive' | 'body' | 'skip' | 'pagination'; typeName: string; optional: boolean }[] = [];

  for (const param of sig.params) {
    const typeName = param.type.name;

    if (SKIP_TYPES.has(typeName)) {
      paramPlan.push({ name: param.name, kind: 'skip', typeName, optional: true });
      continue;
    }

    if (typeName === 'ListOptions') {
      paramPlan.push({ name: param.name, kind: 'pagination', typeName, optional: true });
      continue;
    }

    if (typeName in PRIMITIVES) {
      paramPlan.push({ name: param.name, kind: 'primitive', typeName, optional: param.optional ?? false });
      continue;
    }

    // Object/entity param → body
    paramPlan.push({ name: param.name, kind: 'body', typeName, optional: param.optional ?? false });
  }

  // Register input type if needed
  let inputRef: any;
  const bodyParam = paramPlan.find((p) => p.kind === 'body');
  if (bodyParam && meta.input) {
    // Only strip non-client fields for create/update — other ops may legitimately use them (e.g. publish(id))
    const isMutation = opName === 'create' || opName === 'update';
    const opInputFields = isMutation ? inputFields(meta.input.getFields()) : meta.input.getFields();
    const inputName = `${capitalize(opName)}${entityName}Input`;

    // `undefined` when the view asks for nothing, and `argsDef` already guards on it —
    // the op then takes no input, which is the truth.
    inputRef = registerInput(builder, {
      name: inputName,
      // A real schema over those fields, not a forged stand-in: an update input is the
      // same fields seen through the patch mode.
      schema: Schema.of(opInputFields, undefined, undefined, { patch: opName === 'update' }),
    });
  }

  const hasPagination = paramPlan.some((p) => p.kind === 'pagination');

  const argsDef = (t: any): Record<string, any> => {
    const args: Record<string, any> = {};

    for (const p of paramPlan) {
      if (p.kind === 'primitive') {
        args[p.name] = PRIMITIVES[p.typeName](t, !p.optional);
      }
    }

    if (bodyParam && inputRef) {
      args.input = t.arg({ type: inputRef, required: !bodyParam.optional });
    }

    if (hasPagination) {
      args.limit = t.arg.int();
      args.offset = t.arg.int();
      args.page = t.arg.int();
      args.after = t.arg.string();
      args.orderBy = t.arg.string();
      args.order = t.arg.string();
    }

    return args;
  };

  const buildInvocation = (args: any, gqlCtx: any) => {
    const params: Record<string, any> = {};
    let body: unknown = undefined;

    for (const p of paramPlan) {
      if (p.kind === 'primitive') {
        if (args[p.name] != null) params[p.name] = args[p.name];
      } else if (p.kind === 'body') {
        body = args.input;
      } else if (p.kind === 'pagination') {
        // Collect pagination args into body (ListOptions)
        const options: Record<string, any> = {};
        for (const key of ['limit', 'offset', 'page', 'after', 'orderBy', 'order']) {
          if (args[key] != null) options[key] = args[key];
        }
        body = options;
      }
    }

    return { params, query: {}, body, state: gqlCtx?.state ?? {} };
  };

  return { argsDef, buildInvocation };
}

// ─── Output type resolution ──────────────────────

function resolveOutputType(
  sig: ParsedSignature,
  config: OperationsConfig,
  meta?: OperationMeta,
  opName?: string,
): { type: any; isList: boolean; nullable: boolean } {
  const rt = sig.returnType;

  // boolean → Boolean scalar
  if (rt?.name === 'boolean') {
    return { type: 'Boolean', isList: false, nullable: false };
  }

  // ListResult<T> → paginated list wrapper
  if (rt?.name === 'ListResult') {
    return { type: 'list-wrapper', isList: true, nullable: false };
  }

  /**
   * The type the operation SAYS it returns.
   *
   * `async stats(): Promise<StatsOutput[]>` is a declaration, and the scan already
   * resolved it into a live schema class. Until now this threw it away and announced the
   * entity's type instead, so a schema built from a handler with such an op was simply
   * wrong: its own fields were not queryable, and the entity's came back null.
   *
   * Falls back to the entity when nothing is declared, or when what is declared IS the
   * entity — `publish(): Promise<Post>` must not mint a second Post type.
   */
  const declared = meta?.output && opName && config.viewType
    ? config.viewType(meta.output, opName)
    : undefined;
  const type = declared ?? config.type;

  if (rt?.array) {
    return { type: [type], isList: false, nullable: false };
  }
  return { type, isList: false, nullable: rt?.nullable ?? false };
}

// ─── registerOperations ──────────────────────────

/**
 * Register all GraphQL operations for an entity from parsed handler signatures.
 *
 * Each operation in the map is registered as a Query or Mutation field
 * based on naming convention (list*, find*, get*, search* → Query, else → Mutation).
 *
 * Args are generated from the parsed method signature:
 * - Primitives (string, number) → scalar args
 * - Entity/object params → input types (derived from meta.input)
 * - Partial<T> wrapper → all input fields nullable
 * - ListOptions → standard pagination args
 * - InvocationContext → skipped (injected by resolver)
 */
export function registerOperations(builder: InstanceType<typeof SchemaBuilder>, config: OperationsConfig): void {
  // Pre-register list wrapper type if list op exists
  let listWrapperType: any;
  const listMeta = config.operations.get('list');
  if (listMeta && typeof config.facade.list === 'function') {
    listWrapperType = registerObjectType(builder, `${config.name}List`, {
      items:     { type: [config.type] },
      total:     {
        type: 'int', nullable: true,
        resolve: async (parent: any) => {
          if (parent.total !== undefined) return parent.total;
          if (parent._count) return (await parent._count()).total ?? null;
          return null;
        },
      },
      endCursor: { type: 'string', nullable: true },
      hasMore:   { type: 'boolean', nullable: true },
    });
  }

  for (const [opName, meta] of config.operations) {
    if (typeof config.facade[opName] !== 'function') continue;

    const sig = meta.signature;
    if (!sig) continue;

    const fieldName = config.operationsOverrides?.[opName]?.graphql
      ?? graphqlFieldName(opName, config.name);
    claimRootField(builder, fieldName, `${config.origin ?? config.name}.${opName}`);
    const { argsDef, buildInvocation } = buildArgsFromSignature(sig, meta, builder, opName, config.name);

    // Output type — what the op declares, else the entity's.
    const output = resolveOutputType(sig, config, meta, opName);
    const isListWrapper = output.type === 'list-wrapper';
    const outputType = isListWrapper ? listWrapperType : output.type;
    if (!outputType) continue;

    const fieldDef = (t: any) => ({
      [fieldName]: t.field({
        type: outputType,
        nullable: output.nullable,
        args: argsDef(t),
        ...(meta.description && { description: meta.description }),
        resolve: async (_: any, args: any, gqlCtx: any) => {
          const invocation = buildInvocation(args, gqlCtx);
          const result = await config.facade[opName](invocation);

          // List wrapper: shape the result for the paginated type
          if (isListWrapper) {
            const items = Array.isArray(result) ? [...result] : result;
            return {
              items,
              endCursor: result?.endCursor,
              hasMore: result?.hasMore,
              _count: () => config.facade[opName]({
                ...invocation,
                body: { ...(invocation.body as any ?? {}), count: true, limit: 1 },
              }),
            };
          }

          return result;
        },
      }),
    });

    if (resolveIsReadOp(opName, config.operationsOverrides)) {
      (builder as any).queryFields(fieldDef);
    } else {
      (builder as any).mutationFields(fieldDef);
    }
  }
}
