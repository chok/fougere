import type { CollectorEntry } from '../../descriptor/CollectorEntry.js';
import type { FrondDescriptor } from '../../descriptor/FrondDescriptor.js';
import type { EffectiveOperation } from '../../EffectiveOperation.js';
import type { EffectiveParameter } from '../../EffectiveParameter.js';
import type { BindingPlan } from '../../wire/binding.js';
import type { ErrorCode } from '../../wire/ErrorCode.js';
import { collectorKeyOf } from '../../prefab/collector.js';

/** What a member of a `Collect<User>` chain refuses: from its `missing()`, and from its `collect()`. */
export type Refusing = Pick<CollectorEntry, 'refuses' | 'collecting'>;

/** The collectors a frond's operations can be handed: its own, then its parent's. */
export function collectorsInScope(frond: FrondDescriptor, fronds: readonly FrondDescriptor[]): CollectorEntry[] {
  const own = new Set(frond.collectors.map((collector) => collector.typeName));
  const parent = frond.extends === undefined ? undefined : fronds.find((one) => one.name === frond.extends);
  const inherited = parent && parent !== frond ? collectorsInScope(parent, fronds) : [];

  return [...frond.collectors, ...inherited.filter((collector) => !own.has(collector.typeName))];
}

export function groupedCollectors(collectors: readonly CollectorEntry[]): Map<string, CollectorEntry[]> {
  const grouped = new Map<string, CollectorEntry[]>();
  for (const collector of collectors) {
    const sameName = grouped.get(collector.typeName) ?? [];
    sameName.push(collector);
    grouped.set(collector.typeName, sameName);
  }

  return grouped;
}

export function collectorsOf(
  parameters: readonly EffectiveParameter[],
  collectorsByType: Map<string, CollectorEntry[]>,
  frond: FrondDescriptor,
): EffectiveOperation['collectors'] {
  return parameters.flatMap((parameter) => {
    if (parameter.binding.source.kind !== 'collector') return [];
    const collector = collectorsByType.get(parameter.binding.source.typeName)?.[0];

    return collector ? [{
      parameter: parameter.name,
      typeName: collector.typeName,
      className: collector.ctor.name,
      frond: frond.name,
      filePath: collector.filePath,
    }] : [];
  });
}

/** Each collected type's chain: the collector, and the links in front of it. */
export function chainsOf(frond: FrondDescriptor, fronds: readonly FrondDescriptor[], collectorsByType: Map<string, CollectorEntry[]>): Map<string, Refusing[]> {
  const providers = providersInScope(frond, fronds);

  return new Map([...collectorsByType].map(([typeName, collectors]) => {
    const key = collectorKeyOf(typeName);
    const links = providers.filter((provider) => provider.implements?.includes(key) && provider.deps.includes(key));

    return [typeName, [...collectors, ...links]];
  }));
}

function providersInScope(frond: FrondDescriptor, fronds: readonly FrondDescriptor[]): FrondDescriptor['providers'] {
  const parent = frond.extends === undefined ? undefined : fronds.find((one) => one.name === frond.extends);

  return [...frond.providers, ...(parent && parent !== frond ? providersInScope(parent, fronds) : [])];
}

/** An op's refusals, with what its required collectors refuse. */
export function refusalsWithCollected(
  errors: readonly ErrorCode[] | undefined,
  binding: BindingPlan,
  chainsByType: Map<string, Refusing[]>,
): ErrorCode[] | undefined {
  const collected = binding.flatMap(({ source, optional }) => (source.kind === 'collector'
    ? (chainsByType.get(source.typeName) ?? []).flatMap((collector) => [
      ...(optional ? [] : collector.refuses ?? []),
      ...collector.collecting ?? [],
    ])
    : []));
  if (collected.length === 0) return errors ? [...errors] : undefined;

  return [...new Set([...(errors ?? []), ...collected])].sort();
}
