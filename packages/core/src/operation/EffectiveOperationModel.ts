import { lowerFirst, type SchemaView } from '@fougere/schema';
import { resolveConventions } from '../config/Conventions.js';
import { bindingDrift, operationsWithoutMethod } from './bindingDrift.js';
import { reachedBy, servedBy } from '../module/topology/declared.js';
import type { BindingPlan } from '../wire/binding.js';
import { computeBindingPlan } from '../bindingPlan.js';
import { targetOf } from '../prefab/prefab.js';
import { EFFECTIVE_OPERATION_SEMANTICS } from './EffectiveOperationSemantics.js';
import type { CollectorEntry } from '../descriptor/CollectorEntry.js';
import { chainsOf, collectorsInScope, collectorsOf, groupedCollectors, refusalsWithCollected, type Refusing } from './collectors.js';
import { type FrondDescriptor } from '../descriptor/FrondDescriptor.js';
import type { HandlerEntry } from '../descriptor/HandlerEntry.js';
import { OperationOverrides, type OperationOverrideEntry } from '../descriptor/OperationOverrides.js';
import { protocolsOf } from './protocols.js';
import { servedSurfaces } from '../descriptor/surface.js';
import type { Diagnostic } from '../diagnostic.js';
import { verify } from './verify.js';
import { inferOperationKind, type OperationContract } from '../wire/OperationContract.js';
import { type OperationKind } from '../wire/OperationKind.js';
import { type OperationsMap } from '../wire/OperationsMap.js';
import type { EffectiveParameter } from './EffectiveParameter.js';
import type { EffectiveOperation } from './EffectiveOperation.js';
import type { EffectiveOperationsMap } from './EffectiveOperationsMap.js';
import type { EffectiveOperationOptions } from './EffectiveOperationOptions.js';
import type { Placement } from '../wire/Placement.js';
import { opsOf } from '../prefab/opsOf.js';
import { normalizeBinding, validateProvenance, type BoundContract } from './bindingRefusals.js';

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

/** One resolved program, keeping each handler's identity from the scan. */
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

interface Resolving {
  fronds: readonly FrondDescriptor[];
  frond: FrondDescriptor;
  handler: HandlerEntry;
  schemas: Map<string, SchemaView>;
  served: Map<string, string>;
  collectorsByType: Map<string, CollectorEntry[]>;
  chainsByType: Map<string, Refusing[]>;
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

  const diagnostics = scanDiagnostics.filter((diagnostic) => diagnostic.code === 'input-contract-ambiguous');

  for (const frond of fronds) {
    const seen = collectorsInScope(frond, fronds);
    const collectorsByType = groupedCollectors(seen);
    const collectorNames = new Set(seen.map((collector) => collector.typeName));
    const chainsByType = chainsOf(frond, fronds, collectorsByType);
    const overrides = OperationOverrides.of(frond);
    diagnostics.push(...overrides.refusals());
    for (const handler of frond.handlers) {
      const effective = new Map<string, EffectiveOperation>();
      byHandler.set(handler, effective);
      const contracts = resolveContracts(handler, overrides.at(handler.address), collectorNames);
      diagnostics.push(...bindingDrift(frond, handler));
      diagnostics.push(...operationsWithoutMethod(frond, handler, contracts.keys()));

      const resolving: Resolving = { fronds, frond, handler, schemas, served, collectorsByType, chainsByType, options, diagnostics };
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

function resolveOperation(resolving: Resolving, name: string, rawContract: OperationContract): EffectiveOperation | undefined {
  const { fronds, frond, handler, schemas, served, collectorsByType, chainsByType, options, diagnostics } = resolving;
  const contract = normalizeBinding(rawContract, handler, frond, name, diagnostics);
  if (!contract || !answersData(resolving, name, contract)) return undefined;

  const kind = kindOf(resolving, name);

  const implementation = implementationOf(frond, handler, name, diagnostics);
  if (!implementation) return undefined;

  const parameters = parametersOf(contract);
  if (!validateProvenance(fronds, frond, handler, name, contract, parameters, collectorsByType, diagnostics, options.conventions ?? resolveConventions())) {
    return undefined;
  }

  const announced = contract.binding.find((binding) => binding.source.kind === 'fact' || binding.source.kind === 'pipe');
  const fact = announced?.source.kind === 'fact' || announced?.source.kind === 'pipe'
    ? schemas.get(announced.source.factName)
    : undefined;
  const input = contract.input ?? fact;
  const output = announced?.source.kind === 'pipe' && fact
    ? { schema: fact, closed: false }
    : effectiveOutput(frond, handler, name, contract);

  const errors = refusalsWithCollected(contract.errors, contract.binding, chainsByType);
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
    protocols: protocolsOf(frond, handler.address, name),
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

function placementRefusals(fronds: readonly FrondDescriptor[], options: EffectiveOperationOptions): Diagnostic[] {
  return verify({ fronds }).map((misplaced) => {
    const remoteBoundary = options.remotes?.[misplaced.frond] !== undefined
      || options.remotes?.[misplaced.dependsOn.frond] !== undefined;

    return remoteBoundary && misplaced.code === 'cross-frond-dependency'
      ? { ...misplaced, severity: 'blocking' as const }
      : misplaced;
  });
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
  if (contract.output) return { schema: contract.output, closed: isView(contract.output) };
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

function mergedBinding(derived: BindingPlan | undefined, declared: BindingPlan): BindingPlan {
  if (!derived) return declared;
  const byName = new Map(declared.map((entry) => [entry.name, entry]));
  const named = new Set(derived.map((entry) => entry.name));

  return [...derived.map((entry) => byName.get(entry.name) ?? entry), ...declared.filter((entry) => !named.has(entry.name))];
}

function isView(schema: SchemaView): boolean {
  const { derivation, anchored } = schema as unknown as { derivation?: unknown; anchored?: boolean };

  return derivation !== undefined && !anchored;
}

