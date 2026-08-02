/**
 * @fougere/schema-graphql — génère des types Pothos depuis les entités fougere
 */
import type SchemaBuilder from '@pothos/core';
import type { AnyField, Fields, SchemaLike } from '@fougere/schema';
import { anatomy, boundaryOf, inputFields, resolveBoundary } from '@fougere/schema';

// ─── Types ─────────────────────────────────────────

type EntityClass = SchemaLike & (abstract new (...args: any[]) => any);

/** Presenter instance — each method is a computed field resolver. */
type PresenterInstance = Record<string, (parent: any) => any>;

export interface TypeConfig {
  /** Nom du type GraphQL */
  name: string;
  /** Entity source */
  entity: EntityClass;
  /** Champs à exclure du type GraphQL */
  exclude?: string[];
  /** Relations à résoudre */
  relations?: Record<string, RelationConfig>;
  /** Presenter instance — adds computed fields as resolveFields on this type. */
  presenter?: PresenterInstance;
  /** Presenter field names (methods to expose). If absent, all methods are exposed. */
  presenterFields?: string[];
  /** Per-field type metadata from source parsing. */
  presenterFieldMeta?: { name: string; returnType?: string; nullable?: boolean }[];
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
  /** Nom de l'input GraphQL */
  name: string;
  /** SchemaView source (résultat de pick/omit/partial) */
  schema: SchemaLike;
}

/** Parsed method signature (mirrors core OperationMeta.signature). */
interface ParsedSignature {
  name: string;
  params: { name: string; type: { raw: string; name: string; array?: boolean; nullable?: boolean; generics?: ParsedSignature['params'][0]['type'][] }; optional?: boolean }[];
  returnType?: { raw: string; name: string; array?: boolean; nullable?: boolean; generics?: ParsedSignature['params'][0]['type'][] };
}

/** Metadata for a handler operation (from scanner). */
interface OperationMeta {
  input?: SchemaLike;
  output?: SchemaLike;
  signature?: ParsedSignature;
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
  operationsOverrides?: Record<string, { kind?: 'query' | 'command' }>;
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

const SKIP_TYPES = new Set(['InvocationContext', 'ListOptions']);

// ─── Helpers ───────────────────────────────────────

function fieldToGraphQL(t: any, field: AnyField, fieldName: string): any {
  // Dispatch on the BASE type via anatomy — `shape.type` may be the nullable
  // `[T,'null']` union, a direct comparison would fail silently on it.
  const { base: shape, nullable } = anatomy(field.shape);

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
      // value list (`list(text())`) → liste GraphQL du scalaire des items;
      // items objets → liste de Strings JSON (même règle que 'object')
      const items = anatomy(shape.items).base;
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
            return val != null ? resolveBoundary(field).encode(val) : null;
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

function fieldToInput(t: any, field: AnyField, patch: boolean): any {
  // Required = the presence axis, projected onto GraphQL's single knob: the
  // caller must supply it (no `lifecycle.create` rule answers absence), null is
  // not legal, and the view is not in patch mode (a patch omits freely).
  const { base: shape, nullable } = anatomy(field.shape);
  const required = !patch && !nullable && field.lifecycle?.create === undefined;

  switch (shape?.type) {
    case 'integer':
      return t.int({ required });

    case 'number':
      return t.float({ required });

    case 'boolean':
      return t.boolean({ required });

    case 'array': {
      const items = anatomy(shape.items).base;
      switch (items?.type) {
        case 'integer': return t.intList({ required });
        case 'number': return t.floatList({ required });
        case 'boolean': return t.booleanList({ required });
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
  const fields = config.entity.getFields();
  const exclude = new Set(config.exclude ?? []);

  return (builder as any).objectRef(config.name).implement({
    fields: (t: any) => {
      const result: Record<string, any> = {};

      for (const [fieldName, field] of Object.entries(fields)) {
        if (exclude.has(fieldName)) continue;
        // Skip 'many' fields — handled by relations
        if (field.role?.relation?.kind === 'many') continue;
        // Skip fields that have a relation override
        if (config.relations?.[fieldName]) continue;
        // Write-only (boundary out: 'closed', e.g. password): never emitted
        if (boundaryOf(field).out === 'closed') continue;

        result[fieldName] = fieldToGraphQL(t, field, fieldName);
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
          const resolve = (parent: any) => (fn as Function).call(config.presenter, parent);

          // Map inferred return type → GraphQL scalar
          switch (meta?.returnType) {
            case 'number':
              result[name] = t.float({ nullable, resolve });
              break;
            case 'boolean':
              result[name] = t.boolean({ nullable, resolve });
              break;
            case 'string':
              result[name] = t.string({ nullable, resolve });
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
 * Enregistre un input GraphQL (écriture) depuis un SchemaView.
 *
 * ```ts
 * const CreateProductInput = registerInput(builder, {
 *   name: 'CreateProductInput',
 *   schema: CreateProduct,
 * });
 * ```
 */
export function registerInput(builder: InstanceType<typeof SchemaBuilder>, config: InputConfig): any {
  const fields = config.schema.getFields();
  // Input-field omissibility is a projection of the view's MODE (partial() → patch),
  // never of forged per-field flags — the fields themselves stay untouched.
  const patch = config.schema.getOpts?.()?.patch ?? false;

  return (builder as any).inputType(config.name, {
    fields: (t: any) => {
      const result: Record<string, any> = {};

      for (const [fieldName, field] of Object.entries(fields)) {
        // Skip virtual fields
        if (field.role?.relation?.kind === 'many') continue;
        // Read-only (boundary in: 'closed'): never accepted from a client
        if (boundaryOf(field).in === 'closed') continue;

        result[fieldName] = fieldToInput(t, field, patch);
      }

      return result;
    },
  });
}

// ─── GraphQL field naming ────────────────────────

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

    // Wrap fields as a SchemaLike for registerInput — an update input is the
    // same fields seen through the patch mode, not a set of forged fields.
    inputRef = registerInput(builder, {
      name: inputName,
      schema: { getFields: () => opInputFields, getOpts: () => ({ patch: opName === 'update' }) },
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

  // Array return → list of entity type
  if (rt?.array) {
    return { type: [config.type], isList: false, nullable: false };
  }

  // Everything else → entity type (output scoping is at handler/ORM level)
  return { type: config.type, isList: false, nullable: rt?.nullable ?? false };
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

    const fieldName = graphqlFieldName(opName, config.name);
    const { argsDef, buildInvocation } = buildArgsFromSignature(sig, meta, builder, opName, config.name);

    // Output type — always the entity type (output scoping is at handler/ORM level)
    const output = resolveOutputType(sig, config);
    const isListWrapper = output.type === 'list-wrapper';
    const outputType = isListWrapper ? listWrapperType : output.type;
    if (!outputType) continue;

    const fieldDef = (t: any) => ({
      [fieldName]: t.field({
        type: outputType,
        nullable: output.nullable,
        args: argsDef(t),
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
