import { lowerFirst, upperFirst, type SchemaView } from '@fougere/schema';
import { directoryOf, resolveConventions, type Conventions } from './Conventions.js';
import { statementDrift, unansweredOperations } from './boot/statement-drift.js';
import { reachedBy, servedBy } from './module/topology/declared.js';
import type { BindingPlan } from './wire/binding.js';
import { computeBindingPlan } from './bindingPlan.js';
import { targetOf } from './prefab/prefab.js';
import { EFFECTIVE_OPERATION_SEMANTICS } from './EffectiveOperationSemantics.js';
import type { CollectorEntry } from './descriptor/CollectorEntry.js';
import { collectorsInScope, collectorsOf, groupedCollectors, refuseAmbiguousCollectors, refusalsWithCollected } from './module/collector/operation.js';
import { type FrondDescriptor } from './descriptor/FrondDescriptor.js';
import type { HandlerEntry } from './descriptor/HandlerEntry.js';
import { OperationOverrides, type OperationOverrideEntry } from './descriptor/OperationOverrides.js';
import { servedSurfaces } from './descriptor/surface.js';
import type { Diagnostic } from './diagnostic.js';
import { verify } from './verify.js';
import { inferOperationKind, type OperationContract } from './wire/OperationContract.js';
import { type OperationKind } from './wire/OperationKind.js';
import { type OperationsMap } from './wire/OperationsMap.js';
import { type TypeRef } from './wire/TypeRef.js';
import type { EffectiveParameter } from './EffectiveParameter.js';
import type { EffectiveOperation } from './EffectiveOperation.js';
import type { EffectiveOperationsMap } from './EffectiveOperationsMap.js';
import type { EffectiveOperationOptions } from './EffectiveOperationOptions.js';
import type { Placement } from './wire/Placement.js';
import type { Binding } from './Binding.js';
import { opsOf } from './prefab/opsOf.js';

/** A contract whose parameters are all bound. */
type BoundContract = OperationContract & { binding: BindingPlan };

/**
 * Where an op's work goes: the fronds its handler reaches, and how many are a process away.
 *
 * A frond this app never scanned is not among them. The report can say a call LEFT — that is
 * `placement` — but naming what is on the far side of an address means reading its card, and a
 * card is a discovery rather than a declaration.
 */
function reachOf(
  deps: readonly string[],
  from: string,
  index: Map<string, string>,
  remotes: Record<string, string>,
): EffectiveOperation['reach'] {
  const fronds = reachedBy(deps, from, index)
    .sort()
    .map((frond) => ({ frond, placement: (remotes[frond] ? 'remote' : 'local') as Placement }));

  return { fronds, hops: fronds.filter((one) => one.placement === 'remote').length };
}

/**
 * One resolved program. The handler map preserves object identity from the scan, so the
 * boot never has to find a handler again by an order-dependent name lookup.
 */
export class EffectiveOperationModel {
  constructor(
    readonly operations: EffectiveOperation[],
    readonly diagnostics: Diagnostic[],
    readonly resolutionDiagnostics: Diagnostic[],
    private readonly byHandler: Map<HandlerEntry, EffectiveOperationsMap>,
  ) {}

  forHandler(handler: HandlerEntry): EffectiveOperationsMap {
    return this.byHandler.get(handler) ?? new Map();
  }
}

/** What one handler's operations are resolved against. */
interface Resolving {
  fronds: readonly FrondDescriptor[];
  frond: FrondDescriptor;
  handler: HandlerEntry;
  schemas: Map<string, SchemaView>;
  served: Map<string, string>;
  collectorsByType: Map<string, CollectorEntry[]>;
  options: EffectiveOperationOptions;
  diagnostics: Diagnostic[];
}

/** Resolve the complete operation model without starting the application. */
export function resolveEffectiveOperations(
  fronds: readonly FrondDescriptor[],
  options: EffectiveOperationOptions = {},
): EffectiveOperationModel {
  const operations: EffectiveOperation[] = [];
  const byHandler = new Map<HandlerEntry, EffectiveOperationsMap>();
  const scanDiagnostics = [...(options.diagnostics ?? [])];
  const schemas = new Map(
    fronds.flatMap((frond) => frond.entities.map((entity) => [entity.name, entity.entityClass] as const)),
  );
  const served = servedBy(fronds);

  // Input ambiguity is found by the scanner, where schemas are, but it is a resolution failure.
  const diagnostics = scanDiagnostics.filter((diagnostic) => diagnostic.code === 'input-contract-ambiguous');

  for (const frond of fronds) {
    refuseAmbiguousCollectors(frond, groupedCollectors(frond.collectors), diagnostics);

    const seen = collectorsInScope(frond, fronds);
    const collectorsByType = groupedCollectors(seen);
    const collectorNames = new Set(seen.map((collector) => collector.typeName));
    const overrides = OperationOverrides.of(frond);
    diagnostics.push(...overrides.refusals());
    for (const handler of frond.handlers) {
      const effective = new Map<string, EffectiveOperation>();
      byHandler.set(handler, effective);
      const contracts = resolveContracts(handler, overrides.at(handler.address), collectorNames);
      // A statement wins over the scan on purpose; saying so is what keeps the win from hiding a rename.
      diagnostics.push(...statementDrift(frond, handler));
      diagnostics.push(...unansweredOperations(frond, handler, contracts.keys()));

      const resolving: Resolving = { fronds, frond, handler, schemas, served, collectorsByType, options, diagnostics };
      for (const [name, contract] of contracts) {
        const op = resolveOperation(resolving, name, contract);
        if (!op) continue;
        effective.set(name, op);
        operations.push(op);
      }
    }
  }

  diagnostics.push(...placementRefusals(fronds, options));
  const resolution = uniqueDiagnostics(diagnostics);

  return new EffectiveOperationModel(
    operations,
    uniqueDiagnostics([...scanDiagnostics, ...resolution]),
    resolution,
    byHandler,
  );
}

/** One operation, or nothing when a refusal was written for it. */
function resolveOperation(resolving: Resolving, name: string, rawContract: OperationContract): EffectiveOperation | undefined {
  const { fronds, frond, handler, schemas, served, collectorsByType, options, diagnostics } = resolving;
  const contract = normalizeBinding(rawContract, handler, frond, name, diagnostics);
  if (!contract || !answersData(resolving, name, contract)) return undefined;

  const kind = kindOf(resolving, name);

  const implementation = implementationOf(frond, handler, name, diagnostics);
  if (!implementation) return undefined;

  const parameters = parametersOf(contract);
  if (!validateProvenance(fronds, frond, handler, name, contract, parameters, collectorsByType, diagnostics, options.conventions ?? resolveConventions())) {
    return undefined;
  }

  // A fact is validated by the entity it names, and an op that FINISHES one answers its shape —
  // left to the ordinary projection, the subscriber got a value with no `id`.
  const announced = contract.binding.find((binding) => binding.source.kind === 'fact' || binding.source.kind === 'pipe');
  const fact = announced?.source.kind === 'fact' || announced?.source.kind === 'pipe'
    ? schemas.get(announced.source.factName)
    : undefined;
  const input = contract.input ?? fact;
  const output = announced?.source.kind === 'pipe' && fact
    ? { schema: fact, closed: false }
    : effectiveOutput(frond, handler, name, contract);

  const errors = refusalsWithCollected(contract.errors, contract.binding, collectorsByType);
  const className = handler.ctor.name.replace(/Handler$/, '');
  const surface = handler.surface ? `/${handler.surface}` : '/default';
  const remote = options.remotes?.[frond.name];

  return {
    ...contract,
    ...(input ? { input } : {}),
    ...(output.schema ? { output: output.schema } : {}),
    ...(errors ? { errors } : {}),
    id: `${frond.name}${surface}/${className}.${name}`,
    operation: `${className}.${name}`,
    name,
    kind,
    kindSource: OperationOverrides.of(frond).get(handler.address, name)?.kind ? 'explicit' : 'convention',
    protocols: OperationOverrides.of(frond).protocols(handler.address, name),
    handler: { className: handler.ctor.name, address: handler.address, filePath: handler.filePath },
    implementation,
    binding: contract.binding,
    parameters,
    collectors: collectorsOf(parameters, collectorsByType, frond),
    contexts: parameters
      .filter((parameter) => parameter.binding.source.kind === 'context')
      .map((parameter) => parameter.name),
    frond: frond.name,
    placement: remote ? 'remote' : 'local',
    ...(remote ? { remote } : {}),
    reach: reachOf(handler.deps, frond.name, served, options.remotes ?? {}),
    exposure: {
      surfaces: servedSurfaces(frond, handler).map((surface) => surface ?? 'default'),
      adapters: exposedAdapters(handler, options.protocols),
    },
    outputClosed: output.closed,
    semantics: EFFECTIVE_OPERATION_SEMANTICS,
  };
}

/**
 * An operation answers DATA — what JSON keeps. A declared output is converted by its fields; an
 * undeclared one has nothing to convert it. Measured 2026-09-18: `{ at: new Date(0) }` reaches a
 * local caller as a `Date` and a remote one as a string.
 */
function answersData({ frond, handler, diagnostics }: Resolving, name: string, contract: OperationContract): boolean {
  if (contract.output || !contract.signature?.notData) return true;

  const subject = `${handler.ctor.name}.${name}`;
  diagnostics.push({
    severity: 'blocking',
    code: 'operation-output-not-data',
    filePath: handler.filePath,
    frond: frond.name,
    subject,
    message: `${subject}() returns ${contract.signature.notData}, which has methods, and an operation returns plain data.\n`
      + '  Return an entity, or the plain values you need.',
  });

  return false;
}

/** Stated in `frond.config.ts`, or read off the name: an operation reads when every verb it names reads. */
function kindOf({ frond, handler }: Resolving, name: string): OperationKind {
  return OperationOverrides.of(frond).get(handler.address, name)?.kind ?? inferOperationKind(name);
}

function parametersOf(contract: BoundContract): EffectiveParameter[] {
  const params = contract.signature?.params ?? [];

  return contract.binding.map((binding, position) => {
    const param = params[position];
    const undefinable = binding.optional || param?.optional === true || param?.type.undefined === true;

    return {
      position,
      name: param?.name ?? binding.name,
      type: param?.type.raw ?? null,
      optional: undefinable,
      nullable: param?.type.nullable === true,
      undefinable,
      binding,
    };
  });
}

/** A dependency on a frond that actually runs elsewhere is a refusal, not the warning a future split deserves. */
function placementRefusals(fronds: readonly FrondDescriptor[], options: EffectiveOperationOptions): Diagnostic[] {
  return verify({ fronds }).map((misplaced) => {
    const remoteBoundary = options.remotes?.[misplaced.frond] !== undefined
      || options.remotes?.[misplaced.dependsOn.frond] !== undefined;

    return remoteBoundary && misplaced.code === 'cross-frond-dependency'
      ? { ...misplaced, severity: 'blocking' as const }
      : misplaced;
  });
}

function normalizeBinding(
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

function validateProvenance(
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
      const matches = localCollectors.get(source.typeName) ?? [];
      if (matches.length !== 1) {
        valid = false;
        diagnostics.push({
          severity: 'blocking',
          code: matches.length === 0 ? 'collector-unavailable' : 'collector-ambiguous',
          filePath: handler.filePath,
          frond: frond.name,
          subject: `${handler.ctor.name}.${name}(${parameter.name})`,
          message: matches.length === 0
            ? `${handler.ctor.name}.${name} takes ${parameter.name}: ${parameter.type ?? upperFirst(source.typeName)}, and no collector in the frond '${frond.name}' provides one. `
              + `Add a Collector(${parameter.type ?? upperFirst(source.typeName)}) in ${directoryOf(frond.name, 'collectors', conventions)}.`
            : `${matches.length} collectors in the frond '${frond.name}' provide ${source.typeName}. Keep one.`,
        });
      }
      continue;
    }
    if (source.kind !== 'input' || explicitBinding || ambiguousInput) continue;

    const typeName = lowerFirst(contract.signature?.params[parameter.position]?.type.name ?? '');
    const elsewhere = fronds.flatMap((candidate) => candidate === frond
      ? []
      : candidate.collectors.filter((collector) => collector.typeName === typeName));
    if (elsewhere.length > 0) {
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

function implementationOf(
  frond: FrondDescriptor,
  handler: HandlerEntry,
  name: string,
  diagnostics: Diagnostic[],
): EffectiveOperation['implementation'] | undefined {
  const override = OperationOverrides.of(frond).get(handler.address, name);
  const candidates = override?.handlerName
    ? frond.handlers.filter((candidate) => candidate.ctor.name === override.handlerName)
    : [handler];
  if (candidates.length !== 1) {
    diagnostics.push({
      severity: 'blocking',
      code: candidates.length === 0 ? 'operation-handler-unresolved' : 'operation-handler-ambiguous',
      filePath: handler.filePath,
      frond: frond.name,
      subject: `${handler.ctor.name}.${name}`,
      message: `${handler.ctor.name}.${name} names the handler '${override?.handlerName}', and `
        + `${candidates.length === 0 ? 'no handler has that name' : `${candidates.length} handlers have that name`}.`,
    });

    return undefined;
  }
  const implementation = candidates[0]!;
  const method = override?.method ?? name;
  const declared = implementation.operations.has(method)
    || typeof (implementation.ctor as { prototype?: Record<string, unknown> }).prototype?.[method] === 'function'
    || method in opsOf(implementation.ctor);
  if (!declared) {
    diagnostics.push({
      severity: 'blocking',
      code: 'operation-method-unresolved',
      filePath: handler.filePath,
      frond: frond.name,
      subject: `${handler.ctor.name}.${name}`,
      message: `${handler.ctor.name}.${name} points to ${implementation.ctor.name}.${method}, which does not exist.`,
    });

    return undefined;
  }

  return {
    className: implementation.ctor.name,
    address: implementation.address,
    method,
    filePath: implementation.filePath,
  };
}

function effectiveOutput(
  frond: FrondDescriptor,
  handler: HandlerEntry,
  name: string,
  contract: OperationContract,
): { schema?: SchemaView; closed: boolean } {
  const perOperation = (handler.ctor as { __opOutputs?: Record<string, SchemaView> }).__opOutputs?.[name];
  if (perOperation) return { schema: perOperation, closed: true };
  if (contract.output) return { schema: contract.output, closed: false };
  const handlerWide = handler.outputOverride
    ?? (handler.ctor as { __output?: SchemaView }).__output;
  if (handlerWide) return { schema: handlerWide, closed: false };

  const target = targetOf(handler.ctor) as { name?: string } | undefined;
  const address = target?.name ? lowerFirst(target.name) : handler.address;
  const entity = frond.entities.find((candidate) => candidate.name === address);

  return { ...(entity ? { schema: entity.entityClass } : {}), closed: false };
}

function exposedAdapters(
  handler: HandlerEntry,
  protocols: Record<string, unknown> | undefined,
): string[] {
  if (handler.exposed === false && !handler.surface) return [];

  return Object.keys(protocols ?? {}).sort();
}

function uniqueDiagnostics(diagnostics: readonly Diagnostic[]): Diagnostic[] {
  const seen = new Set<string>();

  return diagnostics.filter((diagnostic) => {
    const key = [diagnostic.code, diagnostic.filePath, diagnostic.subject, diagnostic.message].join('\0');
    if (seen.has(key)) return false;
    seen.add(key);

    return true;
  });
}

/** The contract of every operation a handler serves — the three producers, merged once. */
function resolveContracts(
  handler: Pick<HandlerEntry, 'ctor' | 'operations'>,
  overrides: Map<string, OperationOverrideEntry>,
  collectorTypeNames: Set<string>,
): OperationsMap {
  const declared = opsOf(handler.ctor);
  const contracts: OperationsMap = new Map(Object.entries(declared));

  for (const [opName, scanned] of handler.operations) {
    if (scanned.signature?.inherited && opName in declared) continue;
    contracts.set(opName, scanned.binding
      ? collectedInScope(scanned, collectorTypeNames)
      : { ...scanned, binding: scanned.signature ? computeBindingPlan(scanned.signature.params, collectorTypeNames) : undefined });
  }

  for (const [opName, override] of overrides) {
    const { input, output, binding, description } = override;
    if (input === undefined && output === undefined && binding === undefined && description === undefined) continue;
    contracts.set(opName, {
      ...contracts.get(opName),
      ...(input !== undefined && { input }),
      ...(output !== undefined && { output }),
      ...(binding !== undefined && { binding: mergedBinding(contracts.get(opName)?.binding, binding) }),
      ...(description !== undefined && { description }),
    });
  }

  return contracts;
}

/**
 * A binding the scan wrote saw the frond's own collectors only. A parameter it read from the request,
 * whose type a collector of the frond it extends answers, comes from that collector — and is no
 * longer the body the request is judged against.
 */
function collectedInScope(contract: OperationContract, collectorTypeNames: Set<string>): OperationContract {
  const params = contract.signature?.params ?? [];
  const typeOf = (name: string) => params.find((param) => param.name === name)?.type.name ?? '';
  const moved = (contract.binding ?? []).filter((entry) =>
    entry.source.kind === 'input' && collectorTypeNames.has(lowerFirst(typeOf(entry.name))));
  if (moved.length === 0) return contract;

  const binding = contract.binding!.map((entry) => moved.includes(entry)
    ? { ...entry, source: { kind: 'collector' as const, typeName: lowerFirst(typeOf(entry.name)) } }
    : entry);
  const body = contract.input && moved.some((entry) => typeOf(entry.name) === contract.input!.name);

  return { ...contract, binding, ...(body && { input: undefined }) };
}

/** A declared binding states the exceptions: each entry stands in for the derived one of its name. */
function mergedBinding(derived: BindingPlan | undefined, declared: BindingPlan): BindingPlan {
  if (!derived) return declared;
  const byName = new Map(declared.map((entry) => [entry.name, entry]));
  const named = new Set(derived.map((entry) => entry.name));

  return [...derived.map((entry) => byName.get(entry.name) ?? entry), ...declared.filter((entry) => !named.has(entry.name))];
}
