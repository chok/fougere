/** The operation model after every declaration and convention has been resolved. */
import { lowerFirst, type SchemaView } from '@fougere/schema';
import { statementDrift } from './boot/statement-drift.js';
import { computeBindingPlan, type BindingPlan } from './wire/binding.js';
import { targetOf } from './prefab/prefab.js';
import type { CollectorEntry, FrondDescriptor, HandlerEntry } from './descriptor/frond.js';
import type { ScanDiagnostic } from './scan/result.js';
import { verify } from './verify.js';
import {
  inferOperationKind,
  type OperationContract,
  type OperationKind,
  type OperationsMap,
  type TypeRef,
  knownVerbs,
} from './wire/operation.js';

type Binding = BindingPlan[number];

export interface EffectiveParameter {
  /** Position in the TypeScript signature. Never used to infer provenance. */
  position: number;
  name: string;
  type: string | null;
  optional: boolean;
  nullable: boolean;
  /** `?` and `| undefined` both mean canonical absence. */
  undefinable: boolean;
  /** The resolved provenance of this parameter. */
  binding: Binding;
}

export interface EffectiveCollector {
  parameter: string;
  typeName: string;
  className: string;
  frond: string;
  filePath: string;
}

export interface EffectiveOperation extends OperationContract {
  /** Stable qualified identity: `blog/public/Post.publish`. */
  id: string;
  /** Human-facing identity independent of placement: `Post.publish`. */
  operation: string;
  name: string;
  kind: OperationKind;
  kindSource: 'explicit' | 'convention';
  handler: {
    className: string;
    address: string;
    filePath: string;
  };
  /** The class and method that execute after an optional operation override. */
  implementation: {
    className: string;
    address: string;
    method: string;
    filePath: string;
  };
  /** Every valid operation has a plan, including the empty plan. */
  binding: BindingPlan;
  parameters: EffectiveParameter[];
  collectors: EffectiveCollector[];
  contexts: string[];
  placement: {
    frond: string;
    runtime: 'local' | 'remote';
    remote?: string;
  };
  exposure: {
    surfaces: string[];
    adapters: string[];
  };
  /** Whether output is an explicitly closed per-operation view. */
  outputClosed: boolean;
  semantics: typeof EFFECTIVE_OPERATION_SEMANTICS;
}

export type EffectiveOperationsMap = Map<string, EffectiveOperation>;

/** The absence rules every door normalises to before the handler is invoked. */
export const EFFECTIVE_OPERATION_SEMANTICS = Object.freeze({
  optional: 'undefined' as const,
  undefined: 'absence' as const,
  null: 'explicit-value' as const,
  jsonObjectUndefined: 'omitted' as const,
});

export interface EffectiveOperationOptions {
  diagnostics?: readonly ScanDiagnostic[];
  remotes?: Record<string, string>;
  adapters?: Record<string, boolean | undefined>;
}

/**
 * One resolved program. The handler map preserves object identity from the scan, so the
 * boot never has to find a handler again by an order-dependent name lookup.
 */
export class EffectiveOperationModel {
  readonly operations: EffectiveOperation[];
  readonly diagnostics: ScanDiagnostic[];
  readonly resolutionDiagnostics: ScanDiagnostic[];

  constructor(
    operations: EffectiveOperation[],
    diagnostics: ScanDiagnostic[],
    resolutionDiagnostics: ScanDiagnostic[],
    private readonly byHandler: Map<HandlerEntry, EffectiveOperationsMap>,
  ) {
    this.operations = operations;
    this.diagnostics = diagnostics;
    this.resolutionDiagnostics = resolutionDiagnostics;
  }

  forHandler(handler: HandlerEntry): EffectiveOperationsMap {
    return this.byHandler.get(handler) ?? new Map();
  }
}

/** Resolve the complete operation model without starting the application. */
export function resolveEffectiveOperations(
  fronds: readonly FrondDescriptor[],
  options: EffectiveOperationOptions = {},
): EffectiveOperationModel {
  const operations: EffectiveOperation[] = [];
  const byHandler = new Map<HandlerEntry, EffectiveOperationsMap>();
  const resolutionDiagnostics: ScanDiagnostic[] = [];
  const scanDiagnostics = [...(options.diagnostics ?? [])];
  const schemas = new Map(
    fronds.flatMap((frond) => frond.entities.map((entity) => [entity.name, entity.entityClass] as const)),
  );

  // Input ambiguity is produced where schemas are available (the scanner), but it is a
  // resolution failure. Lift it into the same refusal table as kind/binding/topology.
  resolutionDiagnostics.push(...scanDiagnostics.filter((diagnostic) =>
    diagnostic.code === 'input-contract-ambiguous'));

  for (const frond of fronds) {
    const collectorsByType = groupedCollectors(frond.collectors);
    for (const [typeName, collectors] of collectorsByType) {
      if (collectors.length < 2) continue;
      resolutionDiagnostics.push({
        severity: 'blocking',
        code: 'collector-ambiguous',
        filePath: collectors[0]!.filePath,
        frond: frond.name,
        subject: typeName,
        message: `Frond '${frond.name}' declares ${collectors.length} collectors for '${typeName}' — `
          + `${collectors.map((collector) => collector.ctor.name).sort().join(', ')}. `
          + 'Exactly one collector must own a parameter type.',
      });
    }

    const collectorNames = new Set(frond.collectors.map((collector) => collector.typeName));
    for (const handler of frond.handlers) {
      const effective = new Map<string, EffectiveOperation>();
      byHandler.set(handler, effective);
      const contracts = resolveContracts(handler, frond.operationsOverrides, collectorNames);
      // A statement wins over the scan on purpose; saying so out loud is what keeps the
      // win from hiding a rename. Compared here, where both readings are in hand.
      resolutionDiagnostics.push(...statementDrift(frond, handler));

      for (const [name, rawContract] of contracts) {
        const subject = `${handler.ctor.name}.${name}`;
        const contract = normalizeBinding(rawContract, handler, frond, name, resolutionDiagnostics);
        if (!contract) continue;

        const override = frond.operationsOverrides?.[name];
        const inference = inferOperationKind(name);
        const inferredKinds = new Set<OperationKind>();
        if (inference.kind) inferredKinds.add(inference.kind);
        if (inference.queryMatches.length > 0) inferredKinds.add('query');
        if (inference.commandMatches.length > 0) inferredKinds.add('command');
        const kind = override?.kind
          ?? (inferredKinds.size === 1 ? [...inferredKinds][0] : undefined);
        if (!kind) {
          const ambiguous = inferredKinds.size > 1;
          resolutionDiagnostics.push({
            severity: 'blocking',
            code: ambiguous ? 'operation-kind-ambiguous' : 'operation-kind-unknown',
            filePath: handler.filePath,
            frond: frond.name,
            subject,
            message: ambiguous
              ? `Cannot resolve the kind of ${subject}: its name carries query evidence `
                + `(${inference.queryMatches.join(', ')}) and command evidence `
                + `(${inference.commandMatches.join(', ')}). `
                + `Declare operations.${name}.kind.`
              : `Cannot resolve the kind of ${subject}: '${name}' leads with no known verb. `
                + `Rename it to lead with one, or declare operations.${name}.kind in `
                + `frond.config.ts.\n  query:   ${knownVerbs().query.join(', ')}`
                + `\n  command: ${knownVerbs().command.join(', ')}`,
          });
          continue;
        }

        const implementation = implementationOf(frond, handler, name, resolutionDiagnostics);
        if (!implementation) continue;

        const params = contract.signature?.params ?? [];
        const parameters = contract.binding.map((binding, position) => {
          const param = params[position];
          const undefinable = binding.optional
            || param?.optional === true
            || param?.type.undefined === true;
          return {
            position,
            name: param?.name ?? binding.name,
            type: param?.type.raw ?? null,
            optional: undefinable,
            nullable: param?.type.nullable === true,
            undefinable,
            binding,
          } satisfies EffectiveParameter;
        });

        if (!validateProvenance(
          fronds,
          frond,
          handler,
          name,
          contract,
          parameters,
          collectorsByType,
          resolutionDiagnostics,
        )) continue;

        // A fact is judged by the entity it names. This used to be patched into the
        // facade after resolution, leaving check/explain with a different input.
        let input = contract.input;
        if (!input) {
          const fact = contract.binding.find((binding) => binding.source.kind === 'fact');
          if (fact?.source.kind === 'fact') input = schemas.get(fact.source.factName);
        }

        const output = effectiveOutput(frond, handler, name, contract);
        const className = handler.ctor.name.endsWith('Handler')
          ? handler.ctor.name.slice(0, -'Handler'.length)
          : handler.ctor.name;
        const surface = handler.surface ? `/${handler.surface}` : '/default';
        const remote = options.remotes?.[frond.name];
        const op: EffectiveOperation = {
          ...contract,
          ...(input ? { input } : {}),
          ...(output.schema ? { output: output.schema } : {}),
          id: `${frond.name}${surface}/${className}.${name}`,
          operation: `${className}.${name}`,
          name,
          kind,
          kindSource: override?.kind
            ? 'explicit'
            : 'convention',
          handler: {
            className: handler.ctor.name,
            address: handler.address,
            filePath: handler.filePath,
          },
          implementation,
          binding: contract.binding,
          parameters,
          collectors: parameters.flatMap((parameter) => {
            if (parameter.binding.source.kind !== 'collector') return [];
            const collector = collectorsByType.get(parameter.binding.source.typeName)?.[0];
            return collector ? [{
              parameter: parameter.name,
              typeName: collector.typeName,
              className: collector.ctor.name,
              frond: frond.name,
              filePath: collector.filePath,
            }] : [];
          }),
          contexts: parameters
            .filter((parameter) => parameter.binding.source.kind === 'context')
            .map((parameter) => parameter.name),
          placement: {
            frond: frond.name,
            runtime: remote ? 'remote' : 'local',
            ...(remote ? { remote } : {}),
          },
          exposure: {
            surfaces: surfacesOf(frond, handler),
            adapters: exposedAdapters(handler, options.adapters),
          },
          outputClosed: output.closed,
          semantics: EFFECTIVE_OPERATION_SEMANTICS,
        };
        effective.set(name, op);
        operations.push(op);
      }
    }
  }

  // Topology and DI are part of the same effective program. A dependency targeting an
  // actually remote frond is a refusal, not the warning appropriate to a future split.
  for (const violation of verify({ fronds })) {
    const remoteBoundary = options.remotes?.[violation.frond] !== undefined
      || options.remotes?.[violation.dependsOn.frond] !== undefined;
    resolutionDiagnostics.push({
      severity: remoteBoundary && violation.rule === 'cross-frond-dependency'
        ? 'blocking'
        : violation.severity,
      code: violation.rule,
      filePath: violation.filePath,
      frond: violation.frond,
      subject: violation.subject,
      message: violation.message,
    });
  }

  const resolution = uniqueDiagnostics(resolutionDiagnostics);
  return new EffectiveOperationModel(
    operations,
    uniqueDiagnostics([...scanDiagnostics, ...resolution]),
    resolution,
    byHandler,
  );
}

function groupedCollectors(collectors: readonly CollectorEntry[]): Map<string, CollectorEntry[]> {
  const grouped = new Map<string, CollectorEntry[]>();
  for (const collector of collectors) {
    const sameName = grouped.get(collector.typeName) ?? [];
    sameName.push(collector);
    grouped.set(collector.typeName, sameName);
  }
  return grouped;
}

function normalizeBinding(
  contract: OperationContract,
  handler: HandlerEntry,
  frond: FrondDescriptor,
  name: string,
  diagnostics: ScanDiagnostic[],
): (OperationContract & { binding: BindingPlan }) | undefined {
  const params = contract.signature?.params ?? [];
  if (!contract.binding) {
    if (params.length === 0) return { ...contract, binding: [] };
    diagnostics.push({
      severity: 'blocking',
      code: 'operation-unbound',
      filePath: handler.filePath,
      frond: frond.name,
      subject: `${handler.ctor.name}.${name}`,
      message: `${handler.ctor.name}.${name} declares ${params.length} parameter(s) and has no binding plan.`,
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
      message: `Binding plan for ${handler.ctor.name}.${name} must bind every parameter exactly once by name. `
        + `${invalid.length ? `Invalid: ${invalid.map((param) => param.name).join(', ')}. ` : ''}`
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
  diagnostics: ScanDiagnostic[],
): boolean {
  let valid = true;
  const declared = (handler.ctor as { __ops?: Record<string, OperationContract> }).__ops?.[name];
  const explicitBinding = declared?.binding !== undefined
    || handler.operations.get(name)?.binding !== undefined
    || frond.operationsOverrides?.[name]?.binding !== undefined;
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
          message: `Cannot resolve which parameter of ${handler.ctor.name}.${name} receives the input: `
            + `${matches.map((parameter) => `${parameter.name}: ${parameter.type ?? 'unknown'}`).join('; ')} `
            + 'all match the resolved input contract. Declare an explicit binding plan.',
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
            ? `No collector in frond '${frond.name}' resolves ${parameter.name}: ${parameter.type ?? source.typeName}.`
            : `${matches.length} collectors in frond '${frond.name}' resolve '${source.typeName}'.`,
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
      message: `Cannot resolve a provenance for ${handler.ctor.name}.${name}(`
        + `${parameter.name}: ${parameter.type ?? 'unknown'}). It is not a primitive, context, fact, `
        + 'local collector or resolved input schema. Declare an explicit binding.',
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
  diagnostics: ScanDiagnostic[],
): EffectiveOperation['implementation'] | undefined {
  const override = frond.operationsOverrides?.[name];
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
      message: `Operation ${handler.ctor.name}.${name} names handler '${override?.handlerName}', `
        + `but ${candidates.length} matching handlers were found.`,
    });
    return undefined;
  }
  const implementation = candidates[0]!;
  const method = override?.method ?? name;
  const declared = implementation.operations.has(method)
    || typeof (implementation.ctor as { prototype?: Record<string, unknown> }).prototype?.[method] === 'function'
    || method in ((implementation.ctor as { __ops?: Record<string, unknown> }).__ops ?? {});
  if (!declared) {
    diagnostics.push({
      severity: 'blocking',
      code: 'operation-method-unresolved',
      filePath: handler.filePath,
      frond: frond.name,
      subject: `${handler.ctor.name}.${name}`,
      message: `Operation ${handler.ctor.name}.${name} resolves to `
        + `${implementation.ctor.name}.${method}, but that method does not exist.`,
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

function surfacesOf(frond: FrondDescriptor, handler: HandlerEntry): string[] {
  if (handler.surface) return [handler.surface];
  const surfaces = ['default'];
  for (const [surface, addresses] of Object.entries(frond.surfaces ?? {})) {
    const dedicated = frond.handlers.some((candidate) =>
      candidate.address === handler.address && candidate.surface === surface);
    if (!dedicated && addresses.some((address) =>
      address.toLowerCase() === handler.address.toLowerCase())) surfaces.push(surface);
  }
  return [surfaces[0]!, ...surfaces.slice(1).sort()];
}

function exposedAdapters(
  handler: HandlerEntry,
  adapters: Record<string, boolean | undefined> | undefined,
): string[] {
  if (handler.exposed === false && !handler.surface) return [];
  return Object.entries(adapters ?? {})
    .filter(([, enabled]) => enabled === true)
    .map(([adapter]) => adapter)
    .sort();
}

function uniqueDiagnostics(diagnostics: readonly ScanDiagnostic[]): ScanDiagnostic[] {
  const seen = new Set<string>();
  return diagnostics.filter((diagnostic) => {
    const key = [diagnostic.code, diagnostic.filePath, diagnostic.subject, diagnostic.message].join('\0');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** The contract of every operation a handler serves — the three producers, merged once. */
export function resolveContracts(
  handler: Pick<HandlerEntry, 'ctor' | 'operations'>,
  overrides: FrondDescriptor['operationsOverrides'],
  collectorTypeNames: Set<string>,
): OperationsMap {
  const declared = (handler.ctor as { __ops?: Record<string, OperationContract> }).__ops ?? {};
  const contracts: OperationsMap = new Map(Object.entries(declared));

  for (const [opName, scanned] of handler.operations) {
    if (scanned.signature?.inherited && opName in declared) continue;
    contracts.set(opName, {
      ...scanned,
      binding: scanned.binding
        ?? (scanned.signature ? computeBindingPlan(scanned.signature.params, collectorTypeNames) : undefined),
    });
  }

  for (const [opName, override] of Object.entries(overrides ?? {})) {
    const { input, output, binding, description } = override;
    if (input === undefined && output === undefined && binding === undefined && description === undefined) continue;
    contracts.set(opName, {
      ...contracts.get(opName),
      ...(input !== undefined && { input }),
      ...(output !== undefined && { output }),
      ...(binding !== undefined && { binding }),
      ...(description !== undefined && { description }),
    });
  }

  return contracts;
}
