import { RouteAddress } from '@fougere/core';
import { addressOf, cardinalityOf, computeBindingPlan, type OperationContract, type OperationsMap, type TypeRef } from '@fougere/core/descriptor';
import type { ErrorCode } from '@fougere/core';
import type { Param, Signature } from '@fougere/core/descriptor';
import { FieldSet, type SchemaView } from '@fougere/schema';
import { record } from './run.js';
import { parseAllHandlerMethods, parseRefusals } from './handler-parser.js';

/**
 * Resolve a TypeRef to a runtime schema if available in module exports.
 * Handles arrays, generics (uses base name), and simple references.
 */
function resolveSchema(type: TypeRef, moduleExports: Record<string, unknown>): SchemaView | undefined {
  // An array's element type IS `type.name` — the arity rides beside it, so nothing has
  // to be unwrapped here.
  // For generics like Pagination<Post>, also check inner types
  if (type.generics) {
    for (const g of type.generics) {
      const resolved = moduleExports[g.name];
      if (resolved && typeof resolved === 'function' && 'getFields' in resolved) {
        // `Partial<X>` in a signature IS the patch declaration (Crud.update) —
        // project it onto the schema view instead of dropping the wrapper, so
        // the facade validates in patch mode (absent field → untouched).
        const narrowing = (resolved as { partial?: () => SchemaView }).partial;
        if (type.name === 'Partial' && typeof narrowing === 'function') {
          return narrowing.call(resolved);
        }

        return resolved as unknown as SchemaView;
      }
    }
  }
  const resolved = moduleExports[type.name];
  if (resolved && typeof resolved === 'function' && 'getFields' in resolved) {
    return resolved as unknown as SchemaView;
  }

  return undefined;
}

/**
 * A convention may omit a declaration only when it has one answer.
 *
 * Only values the caller supplies through the BODY are candidates: a schema-typed collector,
 * fact or context parameter is not input merely because it names an entity. Reading them all
 * ignored provenance and took the first schema it met, so swapping two parameters silently
 * changed the contract the façade validated the request against.
 */
function inputOf(
  method: Signature,
  handlerName: string,
  filePath: string,
  collectorTypeNames: Set<string>,
  moduleExports: Record<string, unknown>,
  stated: boolean,
): SchemaView | undefined {
  const binding = computeBindingPlan(method.params, collectorTypeNames);
  const candidates = method.params.flatMap((param, index) => {
    if (binding[index]?.source.kind !== 'input') return [];
    const schema = resolveSchema(param.type, moduleExports);

    return schema ? [{ param, schema }] : [];
  });

  if (candidates.length === 1) return candidates[0]!.schema;
  if (candidates.length < 2 || stated) return undefined;

  const subject = `${handlerName}.${method.name}`;
  record({
    severity: 'blocking',
    code: 'input-contract-ambiguous',
    filePath,
    subject,
    message: `Fougere cannot tell which parameter of ${subject} is its input: `
      + `${candidates.map(({ param }) => `${param.name}: ${param.type.raw}`).join('; ')}. `
      + `Declare it in frond.config.ts: operations: { '${new RouteAddress({ address: addressOf(handlerName), operation: method.name })}': { input } }.`,
  });

  return undefined;
}

/**
 * An answer naming an entity beside another type has no view to go through, and an answer with
 * no view leaves whole: a `writeOnly` field included.
 */
function refuseOutputUnion(method: Signature, read: Reading): void {
  const members = method.returnType?.members ?? [];
  const entities = members.filter((member) => {
    const declared = read.moduleExports[member];

    return typeof declared === 'function' && 'getFields' in declared;
  });
  if (entities.length === 0 || read.stated) return;

  const subject = `${read.handlerName}.${method.name}`;
  record({
    severity: 'blocking',
    code: 'output-contract-ambiguous',
    filePath: read.filePath,
    subject,
    message: `Fougere cannot tell which view ${subject} answers through: ${method.returnType!.raw}. `
      + `Write one operation per type, or declare it in frond.config.ts: `
      + `operations: { '${new RouteAddress({ address: addressOf(read.handlerName), operation: method.name })}': { output } }.`,
  });
}

/** A binding names one fact, so `Fact<A | B>` would listen to a name nothing can announce. */
function refuseFactUnion(method: Signature, read: Reading): void {
  for (const param of method.params) {
    const [fact] = param.type.generics ?? [];
    if (param.type.name !== 'Fact' && param.type.name !== 'Pipe') continue;
    if ((fact?.members?.length ?? 0) < 2) continue;

    record({
      severity: 'blocking',
      code: 'fact-contract-ambiguous',
      filePath: read.filePath,
      subject: `${read.handlerName}.${method.name}`,
      message: `${read.handlerName}.${method.name} listens to ${param.type.raw}, and a parameter takes one fact. `
        + `Write one method per fact.`,
    });
  }
}

/** What one method of a handler is read against, while its contract is built. */
interface Reading {
  handlerName: string;
  filePath: string;
  moduleExports: Record<string, unknown>;
  collectorTypeNames: Set<string>;
  refused: ErrorCode[] | undefined;
  stated: boolean;
}

/**
 * The contract carries the description; `signature` is the raw material it was read from.
 * Leaving it only on the signature meant every consumer had to look one level down, and only
 * the façade did.
 */
function contractOf(parsed: Signature, read: Reading): OperationContract {
  const method = { ...parsed, params: parsed.params.map((param) => identifying(param, read)) };
  const meta: OperationContract = {
    signature: method,
    ...(method.description && { description: method.description }),
    ...(read.refused?.length ? { errors: read.refused } : {}),
  };

  refuseFactUnion(method, read);
  const input = inputOf(
    method, read.handlerName, read.filePath, read.collectorTypeNames, read.moduleExports, read.stated,
  );
  if (input) meta.input = input;

  if (method.returnType) {
    refuseOutputUnion(method, read);
    meta.output = resolveSchema(method.returnType, read.moduleExports);
    // `output` is the shape of one row; this says how many rows come back.
    meta.cardinality = cardinalityOf(method.returnType);
  }

  return meta;
}

/**
 * `id: Post['id']` designates a row when `id` IS Post's primary. `title: Post['title']` borrows
 * the field's rules and designates nothing. A type read from something that is not an entity is
 * an ordinary type.
 */
function identifying(param: Param, read: Reading): Param {
  const { field, ...type } = param.type;
  if (!field) return param;

  const entity = read.moduleExports[field.entity] as SchemaView | undefined;
  if (typeof entity?.getFields !== 'function') return { ...param, type };

  const primary = FieldSet.of(entity.getFields()).primary;

  return primary === field.name ? { ...param, type: { ...param.type, identifies: field.entity } } : param;
}

/** Parse ALL method signatures for unified binding. */
export async function inferOperations(
  filePath: string,
  handlerName: string,
  moduleExports: Record<string, unknown>,
  collectorTypeNames: Set<string>,
  explicitInputs: ReadonlySet<string>,
  declared: Record<string, OperationContract>,
  projectRoot?: string,
): Promise<OperationsMap> {
  const map = new Map<string, OperationContract>();
  let parsed: Awaited<ReturnType<typeof parseAllHandlerMethods>>;
  try {
    parsed = await parseAllHandlerMethods(filePath, projectRoot);
  } catch (cause) {
    // The handler still gets a façade — its methods exist at runtime — but with no
    // contract: no binding plan, no input schema, no doc sentence. It used to
    // return the empty map, so the app served a stranger's idea of the handler and
    // said nothing. The operations are gone; the sentence saying so is not.
    record({
      severity: 'blocking',
      code: 'handler-parse-failed',
      filePath,
      message: 'This handler could not be parsed, so its operations are served without checking their input.',
      cause,
    });

    return map;
  }

  // What every op of this handler can refuse, walked from each `throw` up to whoever reaches
  // it. Read from the SAME program the signatures came from, so a dependency resolves through
  // the checker rather than by name — and a guard living in a helper beside the handler is
  // found, where reading the method's own body would have missed it.
  const refusals = await parseRefusals(
    filePath,
    (name) => name.startsWith(`${handlerName}.`),
    projectRoot,
  ).catch(() => new Map<string, ErrorCode[]>());

  /**
   * A base class the parse could not open — an installed package, typically, whose source is not
   * in the workspace.
   */
  for (const base of parsed.unresolvedHeritage) {
    record({
      severity: 'warning',
      code: 'heritage-unresolved',
      filePath,
      message: `Cannot read the class ${base} this handler extends, so its operations are missing. `
        + 'List them in frond.config.ts under operations:.',
    });
  }

  for (const method of parsed.methods) {
    map.set(method.name, contractOf(method, {
      handlerName, filePath, moduleExports, collectorTypeNames,
      refused: refusals.get(`${handlerName}.${method.name}`),
      stated: declared[method.name]?.input !== undefined
        || explicitInputs.has(new RouteAddress({ address: addressOf(handlerName), operation: method.name }).toString()),
    }));
  }

  // What the base declares of itself — `Repository<Post>`'s five — under what the author wrote:
  // a method written over `create` is the one that runs, so its contract is the one that answers.
  for (const [name, contract] of Object.entries(declared)) {
    if (!map.has(name)) map.set(name, contract);
  }

  return map;
}
