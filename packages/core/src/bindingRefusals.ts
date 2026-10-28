import { lowerFirst, upperFirst, type SchemaView } from '@fougere/schema';
import { directoryOf, type Conventions } from './Conventions.js';
import type { BindingPlan } from './wire/binding.js';
import type { CollectorEntry } from './descriptor/CollectorEntry.js';
import type { FrondDescriptor } from './descriptor/FrondDescriptor.js';
import type { HandlerEntry } from './descriptor/HandlerEntry.js';
import { OperationOverrides } from './descriptor/OperationOverrides.js';
import type { Diagnostic } from './diagnostic.js';
import type { OperationContract } from './wire/OperationContract.js';
import type { TypeRef } from './wire/TypeRef.js';
import type { EffectiveParameter } from './EffectiveParameter.js';
import type { Binding } from './Binding.js';
import { opsOf } from './prefab/opsOf.js';

/** A contract whose parameters are all bound. */
export type BoundContract = OperationContract & { binding: BindingPlan };

export function normalizeBinding(
  contract: OperationContract,
  handler: HandlerEntry,
  frond: FrondDescriptor,
  name: string,
  diagnostics: Diagnostic[],
): BoundContract | undefined {
  const params = contract.signature?.params ?? [];
  if (!contract.binding) {
    if (params.length === 0) return { ...contract, binding: [] };
    diagnostics.push({
      severity: 'blocking',
      code: 'operation-unbound',
      filePath: handler.filePath,
      frond: frond.name,
      subject: `${handler.ctor.name}.${name}`,
      message: `${handler.ctor.name}.${name} takes ${params.length} parameter(s), and nothing says where each comes from. Give it a binding.`,
    });

    return undefined;
  }
  if (params.length === 0) return { ...contract, binding: contract.binding };

  // Explicit plans are matched by parameter name and then placed in signature order.
  // Array order is never allowed to become semantic authority.
  const byName = new Map<string, Binding[]>();
  for (const binding of contract.binding) {
    const sameName = byName.get(binding.name) ?? [];
    sameName.push(binding);
    byName.set(binding.name, sameName);
  }
  const expected = new Set(params.map((param) => param.name));
  const invalid = params.filter((param) => (byName.get(param.name)?.length ?? 0) !== 1);
  const extras = [...byName.keys()].filter((binding) => !expected.has(binding));
  if (invalid.length > 0 || extras.length > 0) {
    diagnostics.push({
      severity: 'blocking',
      code: 'operation-binding-invalid',
      filePath: handler.filePath,
      frond: frond.name,
      subject: `${handler.ctor.name}.${name}`,
      message: `The binding of ${handler.ctor.name}.${name} must name each parameter once. `
        + `${invalid.length ? `Missing or repeated: ${invalid.map((param) => param.name).join(', ')}. ` : ''}`
        + `${extras.length ? `Unknown: ${extras.join(', ')}.` : ''}`,
    });

    return undefined;
  }

  return {
    ...contract,
    binding: params.map((param) => byName.get(param.name)![0]!),
  };
}

export function validateProvenance(
  fronds: readonly FrondDescriptor[],
  frond: FrondDescriptor,
  handler: HandlerEntry,
  name: string,
  contract: OperationContract & { binding: BindingPlan },
  parameters: EffectiveParameter[],
  localCollectors: Map<string, CollectorEntry[]>,
  diagnostics: Diagnostic[],
  conventions: Conventions,
): boolean {
  let valid = true;
  const declared = opsOf(handler.ctor)[name];
  const explicitBinding = declared?.binding !== undefined
    || handler.operations.get(name)?.binding !== undefined
    || OperationOverrides.of(frond).get(handler.address, name)?.binding !== undefined;
  const ambiguousInput = diagnostics.some((diagnostic) =>
    diagnostic.code === 'input-contract-ambiguous'
    && diagnostic.subject === `${handler.ctor.name}.${name}`);
  const fromInput = parameters.filter((parameter) => parameter.binding.source.kind === 'input');
  const inferredBody = new Set<EffectiveParameter>();

  if (!explicitBinding && !ambiguousInput && contract.input) {
    if (fromInput.length === 1) {
      inferredBody.add(fromInput[0]!);
    } else if (fromInput.length > 1) {
      const matches = fromInput.filter((parameter) =>
        schemaMatches(contract.input!, contract.signature?.params[parameter.position]?.type));
      if (matches.length > 1) {
        diagnostics.push({
          severity: 'blocking',
          code: 'parameter-binding-ambiguous',
          filePath: handler.filePath,
          frond: frond.name,
          subject: `${handler.ctor.name}.${name}`,
          message: `Several parameters of ${handler.ctor.name}.${name} could take the request body: `
            + `${matches.map((parameter) => `${parameter.name}: ${parameter.type ?? 'unknown'}`).join('; ')}. `
            + 'Give it a binding that says which.',
        });

        return false;
      }
      if (matches.length === 1) inferredBody.add(matches[0]!);
    }
  }

  // A type written with an inline object literal names nothing a collector can register
  // under, so the parameter IS the input. Only a NAMED type can be the wrong-frond
  // substitution the refusal below exists for.
  for (const parameter of fromInput) {
    if (structural(contract.signature?.params[parameter.position]?.type)) inferredBody.add(parameter);
  }

  for (const parameter of parameters) {
    const source = parameter.binding.source;
    if (source.kind === 'collector') {
      if (!localCollectors.has(source.typeName)) {
        valid = false;
        diagnostics.push({
          severity: 'blocking',
          code: 'collector-unavailable',
          filePath: handler.filePath,
          frond: frond.name,
          subject: `${handler.ctor.name}.${name}(${parameter.name})`,
          message: `${handler.ctor.name}.${name} takes ${parameter.name}: ${parameter.type ?? upperFirst(source.typeName)}, and no collector in the frond '${frond.name}' provides one. `
            + `Add a class extending Collect<${parameter.type ?? upperFirst(source.typeName)}> in ${directoryOf(frond.name, 'services', conventions)}.`,
        });
      }
      continue;
    }
    if (source.kind !== 'input' || explicitBinding || ambiguousInput) continue;

    const typeName = lowerFirst(contract.signature?.params[parameter.position]?.type.name ?? '');
    const inOtherFronds = fronds.flatMap((candidate) => candidate === frond
      ? []
      : candidate.collectors.filter((collector) => collector.typeName === typeName));
    if (inOtherFronds.length > 0) {
      // verify() supplies the more complete topology diagnostic; do not also call this
      // an unknown input.
      continue;
    }

    // An inferred input must be backed by exactly one resolved interpretation. With one
    // input, the value itself is sufficient evidence; with several, exactly one type may
    // match. Explicit plans are authoritative because they state every provenance.
    const recognized = explicitBinding || inferredBody.has(parameter);
    if (recognized) continue;
    valid = false;
    diagnostics.push({
      severity: 'blocking',
      code: 'parameter-binding-unknown',
      filePath: handler.filePath,
      frond: frond.name,
      subject: `${handler.ctor.name}.${name}(${parameter.name})`,
      message: `Fougere cannot tell where ${parameter.name}: ${parameter.type ?? 'unknown'} of ${handler.ctor.name}.${name} comes from. `
        + 'Type it as an entity or a view of one, a primitive, a Fact<…>, or a type a collector of this frond provides.',
    });
  }

  return valid;
}

function structural(type: TypeRef | undefined): boolean {
  return type !== undefined && type.raw.includes('{');
}

function schemaMatches(schema: SchemaView, type: TypeRef | undefined): boolean {
  const names = new Set([schema.name, schema.derivation?.sourceName].filter(Boolean));
  if (type?.name && names.has(type.name)) return true;

  return type?.generics?.some((generic) => generic.name && names.has(generic.name)) ?? false;
}
