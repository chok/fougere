import {
  resolveEffectiveOperations,
  type EffectiveOperation,
  type OperationContract,
} from '@fougere/core';
import { relative } from 'node:path';
import ProjectScan from '../services/ProjectScan.js';
import { ANONYMOUS_SCHEMA_NAME, registrationKeyOf, type SchemaView } from '@fougere/schema';

type Cardinality = NonNullable<OperationContract['cardinality']>;
type Binding = EffectiveOperation['binding'][number];

export type ExplainedBinding =
  | { kind: 'collector'; typeName: string }
  | { kind: 'fact'; factName: string }
  | { kind: 'param'; name: string; coerce?: 'number' | 'boolean' }
  | { kind: 'body' }
  | { kind: 'context' }
  | { kind: 'query' };

export interface ExplainedParameter {
  name: string;
  type: string | null;
  optional: boolean;
  nullable: boolean;
  undefinable: boolean;
  binding: ExplainedBinding | null;
}

export interface ExplainedCollector {
  typeName: string;
  class: string;
  file: string;
}

/** Stable, JSON-shaped projection of core's canonical EffectiveOperation. */
export interface ExplainResult {
  operation: string;
  handler: {
    class: string;
    address: string;
    method: string;
    file: string | null;
  };
  kind: 'query' | 'command';
  description: string | null;
  input: string | null;
  output: { type: string; cardinality: Cardinality | null } | null;
  parameters: ExplainedParameter[];
  collectors: ExplainedCollector[];
  contexts: string[];
  semantics: EffectiveOperation['semantics'];
  exposure: {
    surfaces: string[];
    adapters: string[];
  };
  placement: {
    frond: string;
    runtime: 'local' | 'remote';
    remote: string | null;
  };
}

interface Selector {
  frond?: string;
  surface?: string;
  address: string;
  op: string;
}

/** Read one operation directly from the model boot and check also consume. */
export default class ExplainHandler {
  constructor(private projectScan: ProjectScan) {}

  async execute(input: { operation?: string; root?: string; json?: boolean }): Promise<ExplainResult> {
    const requested = input.operation?.trim();
    if (!requested) throw new Error('Usage: fougere explain <Operation> [--json] [--root <directory>]');

    const selector = parseSelector(requested);
    const scan = await this.projectScan.at(input.root);
    const model = resolveEffectiveOperations(scan.fronds, {
      diagnostics: scan.diagnostics,
      remotes: scan.config.remotes,
      adapters: scan.config.adapters,
    });
    const candidates = model.operations.filter((operation) => matches(operation, selector));

    if (candidates.length === 0) {
      const failed = model.resolutionDiagnostics.find((diagnostic) =>
        diagnostic.subject?.toLowerCase().includes(`.${selector.op.toLowerCase()}`)
        && diagnostic.subject.toLowerCase().includes(selector.address.toLowerCase()));
      if (failed) throw new Error(`[${failed.code}] ${failed.message}`);

      const available = model.operations.map((operation) => operation.id).sort();
      throw new Error(
        `Unknown operation '${requested}'. `
        + (available.length > 0
          ? `Available operations: ${available.join(', ')}.`
          : 'This project exposes no resolved operation.'),
      );
    }

    if (candidates.length > 1) {
      throw new Error(
        `Ambiguous operation '${requested}'. Matches: `
        + `${candidates.map((operation) => operation.id).sort().join(', ')}. `
        + 'Use one of these qualified names.',
      );
    }

    const selected = candidates[0]!;
    const invalid = model.resolutionDiagnostics.find((diagnostic) =>
      diagnostic.subject?.startsWith(`${selected.handler.className}.${selected.name}`));
    if (invalid) throw new Error(`[${invalid.code}] ${invalid.message}`);

    return project(selected, scan.root);
  }
}

function project(operation: EffectiveOperation, root: string): ExplainResult {
  return {
    operation: operation.operation,
    handler: {
      class: operation.implementation.className,
      address: operation.handler.address,
      method: operation.implementation.method,
      file: operation.implementation.filePath
        ? relative(root, operation.implementation.filePath)
        : null,
    },
    kind: operation.kind,
    description: operation.description ?? null,
    input: inputTypeOf(operation),
    output: outputOf(operation),
    parameters: operation.parameters.map((parameter) => ({
      name: parameter.name,
      type: parameter.type,
      optional: parameter.optional,
      nullable: parameter.nullable,
      undefinable: parameter.undefinable,
      binding: bindingOf(parameter.binding),
    })),
    collectors: operation.collectors.map((collector) => ({
      typeName: collector.typeName,
      class: collector.className,
      file: relative(root, collector.filePath),
    })),
    contexts: operation.contexts,
    semantics: operation.semantics,
    exposure: operation.exposure,
    placement: {
      frond: operation.placement.frond,
      runtime: operation.placement.runtime,
      remote: operation.placement.remote ?? null,
    },
  };
}

function parseSelector(value: string): Selector {
  const dot = value.lastIndexOf('.');
  if (dot <= 0 || dot === value.length - 1) {
    throw new Error(`Invalid operation '${value}'. Expected '<Handler>.<method>', for example 'Post.publish'.`);
  }

  const path = value.slice(0, dot).split('/').filter(Boolean);
  if (path.length === 0 || path.length > 3) {
    throw new Error(`Invalid operation '${value}'. Expected 'Post.publish', 'blog/Post.publish', or 'blog/public/Post.publish'.`);
  }

  const qualifiers = path.slice(0, -1);
  return {
    ...(qualifiers[0] ? { frond: qualifiers[0] } : {}),
    ...(qualifiers[1] ? { surface: qualifiers[1] } : {}),
    address: addressOf(path.at(-1)!),
    op: value.slice(dot + 1),
  };
}

function matches(operation: EffectiveOperation, selector: Selector): boolean {
  return operation.handler.address.toLowerCase() === selector.address.toLowerCase()
    && operation.name === selector.op
    && (!selector.frond || operation.placement.frond === selector.frond)
    && (!selector.surface || operation.exposure.surfaces.includes(selector.surface));
}

function addressOf(value: string): string {
  const base = value.endsWith('Handler') ? value.slice(0, -'Handler'.length) : value;
  return registrationKeyOf(base);
}

function inputTypeOf(operation: EffectiveOperation): string | null {
  const body = operation.parameters.find((parameter) => parameter.binding.source.kind === 'body');
  return body?.type ?? schemaName(operation.input) ?? null;
}

function outputOf(operation: EffectiveOperation): ExplainResult['output'] {
  const type = schemaName(operation.output) ?? parsedOutput(operation.signature?.returnType?.raw);
  return type ? { type, cardinality: operation.cardinality ?? null } : null;
}

function schemaName(schema: SchemaView | undefined): string | undefined {
  if (!schema) return undefined;
  if (schema.name && schema.name !== ANONYMOUS_SCHEMA_NAME) return schema.name;
  return schema.derivation?.sourceName;
}

function parsedOutput(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  return raw.startsWith('Promise<') && raw.endsWith('>') ? raw.slice(8, -1) : raw;
}

function bindingOf(binding: Binding): ExplainedBinding {
  return { ...binding.source } as ExplainedBinding;
}
