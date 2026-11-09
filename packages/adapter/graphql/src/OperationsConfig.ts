import { upperFirst } from '@fougere/schema';
import type SchemaBuilder from '@pothos/core';
import { Schema } from '@fougere/schema';
import type { SchemaView } from '@fougere/schema';
import { Visibility } from '@fougere/schema';
import type { Signature } from '@fougere/core/descriptor';
import type { OperationMeta } from './OperationMeta.js';
import { registerInput, registerObjectType } from './registerTypes.js';
import { claimRootField, rootFieldOf } from './rootFields.js';

export interface OperationsConfig {
  /** Entity name (PascalCase) — what a root field is named after: `listAuthor`. */
  name: string;
  /**
   * What the types it builds are named after, its frond first; defaults to `name`.
   * Ex: `BlogAuthor`.
   */
  typeName?: string;
  /** GraphQL entity type ref (from registerType). */
  type: any;
  /** Handler facade — each op receives InvocationContext. */
  facade: Record<string, Function>;
  /** Operations metadata from scanner (signature + resolved schemas). */
  operations: Map<string, OperationMeta>;
  /**
   * Who is registering, named when two ops claim one root field.
   * Ex: `catalog/ChapterHandler`.
   */
  origin?: string;
  /** The GraphQL type for a schema an operation declares as its return. */
  viewType?: (view: SchemaView, opName: string) => any;
}

function operationIsQuery(
  name: string,
  resolved?: OperationMeta['kind'],
): boolean {
  if (!resolved) {
    throw new Error(
      `GraphQL cannot project '${name}' without its resolved operation kind. `
      + 'Pass the EffectiveOperation table produced by core.',
    );
  }

  return resolved === 'query';
}

const PRIMITIVES: Record<string, (t: any, required: boolean) => any> = {
  string: (t, r) => t.arg.string({ required: r }),
  number: (t, r) => t.arg.int({ required: r }),
  boolean: (t, r) => t.arg.boolean({ required: r }),
};

const SKIP_TYPES = new Set(['InvocationContext']);

interface ArgsResult {
  argsDef: (t: any) => Record<string, any>;
  buildInvocation: (args: any, gqlCtx: any) => { params: Record<string, any>; query: Record<string, any>; input: unknown; state: Record<string, any> };
}

function buildArgsFromSignature(
  sig: Signature,
  meta: OperationMeta,
  builder: InstanceType<typeof SchemaBuilder>,
  opName: string,
  entityName: string,
): ArgsResult {
  const paramPlan: {
    name: string;
    kind: 'primitive' | 'input' | 'skip' | 'pagination';
    typeName: string;
    optional: boolean;
    nullable: boolean;
  }[] = [];
  const bindings = new Map((meta.binding ?? []).map((binding) => [binding.name, binding]));

  for (const param of sig.params) {
    const typeName = param.type.name;
    const binding = bindings.get(param.name);

    if (binding) {
      switch (binding.source.kind) {
        case 'collector':
        case 'context':
        case 'fact':
          paramPlan.push({ name: param.name, kind: 'skip', typeName, optional: true, nullable: param.type.nullable === true });
          continue;
        case 'query':
          paramPlan.push({ name: param.name, kind: 'pagination', typeName, optional: binding.optional, nullable: param.type.nullable === true });
          continue;
        case 'param':
          paramPlan.push({ name: param.name, kind: 'primitive', typeName, optional: binding.optional, nullable: param.type.nullable === true });
          continue;
        case 'input':
          paramPlan.push({ name: param.name, kind: 'input', typeName, optional: binding.optional, nullable: param.type.nullable === true });
          continue;
      }
    }

    if (SKIP_TYPES.has(typeName)) {
      paramPlan.push({ name: param.name, kind: 'skip', typeName, optional: true, nullable: param.type.nullable === true });
      continue;
    }

    if (typeName === 'ListOptions') {
      paramPlan.push({ name: param.name, kind: 'pagination', typeName, optional: true, nullable: param.type.nullable === true });
      continue;
    }

    if (typeName in PRIMITIVES) {
      paramPlan.push({ name: param.name, kind: 'primitive', typeName, optional: param.optional ?? false, nullable: param.type.nullable === true });
      continue;
    }

    paramPlan.push({ name: param.name, kind: 'input', typeName, optional: param.optional ?? false, nullable: param.type.nullable === true });
  }

  let inputRef: any;
  const inputParam = paramPlan.find((p) => p.kind === 'input');
  if (inputParam && meta.input) {
    const isMutation = opName === 'create' || opName === 'update';
    const opInputFields = isMutation ? Visibility.of(meta.input.getFields()).input : meta.input.getFields();
    const inputName = `${upperFirst(opName)}${entityName}Input`;

    inputRef = registerInput(builder, {
      name: inputName,
      schema: Schema.of({ fields: opInputFields, opts: { patch: opName === 'update' } }),
    });
  }

  const hasPagination = paramPlan.some((p) => p.kind === 'pagination');

  const argsDef = (t: any): Record<string, any> => {
    const args: Record<string, any> = {};

    for (const p of paramPlan) {
      if (p.kind === 'primitive') {
        args[p.name] = PRIMITIVES[p.typeName](t, !p.optional && !p.nullable);
      }
    }

    if (inputParam && inputRef) {
      args.input = t.arg({ type: inputRef, required: !inputParam.optional && !inputParam.nullable });
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
    let input: unknown = undefined;

    for (const p of paramPlan) {
      if (p.kind === 'primitive') {
        if (args[p.name] !== undefined) params[p.name] = args[p.name];
      } else if (p.kind === 'input') {
        input = args.input;
      } else if (p.kind === 'pagination') {
        const options: Record<string, any> = {};
        for (const key of ['limit', 'offset', 'page', 'after', 'orderBy', 'order']) {
          if (args[key] !== undefined) options[key] = args[key];
        }
        input = options;
      }
    }

    return { params, query: {}, input, state: gqlCtx?.state ?? {} };
  };

  return { argsDef, buildInvocation };
}


const ANSWERED_SCALARS: Record<string, string> = { boolean: 'Boolean', number: 'Float', string: 'String' };

interface OutputType {
  type: any;
  isList: boolean;
  nullable: boolean;
  serialized?: boolean;
}

function resolveOutputType(
  sig: Signature,
  config: OperationsConfig,
  meta?: OperationMeta,
  opName?: string,
): OutputType {
  const rt = sig.returnType;
  const nullable = rt?.nullable === true || rt?.undefined === true;

  const scalar = rt && ANSWERED_SCALARS[rt.name];
  if (scalar) return { type: rt.array ? [scalar] : scalar, isList: false, nullable };
  if (rt?.name === 'void') return { type: 'Boolean', isList: false, nullable: true };

  if (rt?.name === 'Page' || rt?.name === 'ListResult') {
    return { type: 'list-wrapper', isList: true, nullable: false };
  }

  const declared = meta?.output && opName && config.viewType
    ? config.viewType(meta.output, opName)
    : undefined;
  if (!declared && (rt || !config.type)) {
    return { type: rt?.array ? ['String'] : 'String', isList: false, nullable, serialized: true };
  }
  const type = declared ?? config.type;

  if (rt?.array) {
    return { type: [type], isList: false, nullable: false };
  }

  return { type, isList: false, nullable };
}

function serializedAnswer(result: unknown): unknown {
  if (Array.isArray(result)) return result.map(serializedAnswer);
  if (result === null || result === undefined) return null;

  return typeof result === 'string' ? result : JSON.stringify(result);
}


/** Register all GraphQL operations for an entity from parsed handler signatures. */
export function registerOperations(builder: InstanceType<typeof SchemaBuilder>, config: OperationsConfig): void {
  let listWrapperType: any;
  const listMeta = config.operations.get('list');
  if (listMeta && config.type && typeof config.facade.list === 'function') {
    listWrapperType = registerObjectType(builder, `${config.typeName ?? config.name}List`, {
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
    if (typeof config.facade[opName] !== 'function') {
      throw new Error(
        `GraphQL EffectiveOperation table exposes '${opName}' but its facade does not.`,
      );
    }

    const sig = meta.signature;
    if (!sig) continue;

    const fieldName = rootFieldOf(opName, config.name, meta);
    claimRootField(builder, fieldName, `${config.origin ?? config.name}.${opName}`);
    const { argsDef, buildInvocation } = buildArgsFromSignature(sig, meta, builder, opName, config.typeName ?? config.name);

    const output = resolveOutputType(sig, config, meta, opName);
    const isListWrapper = output.type === 'list-wrapper';
    const outputType = isListWrapper ? listWrapperType : output.type;

    const fieldDef = (t: any) => ({
      [fieldName]: t.field({
        type: outputType,
        nullable: output.nullable,
        args: argsDef(t),
        ...(meta.description && { description: meta.description }),
        resolve: async (_: any, args: any, gqlCtx: any) => {
          const invocation = buildInvocation(args, gqlCtx);
          const result = await config.facade[opName](invocation);
          if (output.serialized) return serializedAnswer(result);

          if (isListWrapper) {
            const page = result as { items?: unknown[] } | null;
            const items = Array.isArray(result) ? [...result]
              : Array.isArray(page?.items) ? page.items
              : result;

            return {
              items,
              endCursor: result?.endCursor,
              hasMore: result?.hasMore,
              _count: () => config.facade[opName]({
                ...invocation,
                input: { ...(invocation.input as any ?? {}), count: true, limit: 1 },
              }),
            };
          }

          return result;
        },
      }),
    });

    if (operationIsQuery(opName, meta.kind)) {
      (builder as any).queryFields(fieldDef);
    } else {
      (builder as any).mutationFields(fieldDef);
    }
  }
}
