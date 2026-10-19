import type { CollectorEntry } from '../../descriptor/CollectorEntry.js';
import type { FrondDescriptor } from '../../descriptor/FrondDescriptor.js';
import type { Diagnostic } from '../../diagnostic.js';
import type { EffectiveOperation } from '../../EffectiveOperation.js';
import type { EffectiveParameter } from '../../EffectiveParameter.js';

/**
 * The collectors a frond's operations can be handed: its own, then those of the frond it extends —
 * the same reach its scope has at call time. Its own masks its parent's for one type.
 */
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

export function refuseAmbiguousCollectors(
  frond: FrondDescriptor,
  collectorsByType: Map<string, CollectorEntry[]>,
  diagnostics: Diagnostic[],
): void {
  for (const [typeName, collectors] of collectorsByType) {
    if (collectors.length < 2) continue;
    diagnostics.push({
      severity: 'blocking',
      code: 'collector-ambiguous',
      filePath: collectors[0]!.filePath,
      frond: frond.name,
      subject: typeName,
      message: `${collectors.length} collectors in the frond '${frond.name}' provide ${typeName}: `
        + `${collectors.map((collector) => collector.ctor.name).sort().join(', ')}. Keep one.`,
    });
  }
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
