import { RouteAddress } from '@fougere/core';
import { addressOf, cardinalityOf, computeBindingPlan, type OperationContract, type OperationsMap, type TypeRef } from '@fougere/core/descriptor';
import type { ErrorCode } from '@fougere/core';
import type { Param, Signature } from '@fougere/core/descriptor';
import { FieldSet, type SchemaView } from '@fougere/schema';
import { record } from './run.js';
import { parseAllHandlerMethods, parseRefusals } from './handler-parser.js';

function resolveSchema(type: TypeRef, moduleExports: Record<string, unknown>): SchemaView | undefined {
  if (type.generics) {
    for (const g of type.generics) {
      const resolved = moduleExports[g.name];
      if (resolved && typeof resolved === 'function' && 'getFields' in resolved) {
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

interface Reading {
  handlerName: string;
  filePath: string;
  moduleExports: Record<string, unknown>;
  collectorTypeNames: Set<string>;
  refused: ErrorCode[] | undefined;
  stated: boolean;
}

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
    meta.cardinality = cardinalityOf(method.returnType);
  }

  return meta;
}

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
    record({
      severity: 'blocking',
      code: 'handler-parse-failed',
      filePath,
      message: 'This handler could not be parsed, so its operations are served without checking their input.',
      cause,
    });

    return map;
  }

  const refusals = await parseRefusals(
    filePath,
    (name) => name.startsWith(`${handlerName}.`),
    projectRoot,
  ).catch(() => new Map<string, ErrorCode[]>());

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

  for (const [name, contract] of Object.entries(declared)) {
    if (!map.has(name)) map.set(name, contract);
  }

  return map;
}
