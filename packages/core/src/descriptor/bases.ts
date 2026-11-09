import { type ProviderEntry } from './ProviderEntry.js';
import type { FrondDescriptor } from './FrondDescriptor.js';
import { subjectKeyOf } from '../wire/SubjectKey.js';
import { upperFirst } from '@fougere/schema';

export { subjectKeyOf } from '../wire/SubjectKey.js';

/** What realizes a port opened on an entity: a collector or a presenter. */
export function realizationsOf(frond: Pick<FrondDescriptor, 'collectors' | 'presenters'>): ProviderEntry[] {
  return [
    ...frond.collectors.map(({ ctor, deps, filePath, typeName }) => ({ ctor, deps, filePath, name: ctor.name, implements: [subjectKeyOf('Collect', upperFirst(typeName))] })),
    ...frond.presenters.map(({ ctor, deps, filePath, entityName }) => ({ ctor, deps, filePath, name: ctor.name, implements: [subjectKeyOf('Present', upperFirst(entityName))] })),
  ];
}

/**
 * Port class name → every concrete class below it, in scan order.
 *
 * Documented: [ports](https://fougere.dev/docs/concepts/port).
 */
export function basesOf(
  providers: ProviderEntry[],
  answers: (name: string) => boolean,
): Map<string, ProviderEntry[]> {
  const bases = new Map<string, ProviderEntry[]>();
  for (const provider of providers) {
    if (provider.abstract) continue;
    for (const port of portsOf(provider, answers)) bases.set(port, [...(bases.get(port) ?? []), provider]);
  }

  return bases;
}

function portsOf(provider: ProviderEntry, answers: (name: string) => boolean): string[] {
  const declared = provider.implements ?? [];
  const subjectOf = (port: string) => declared.some((key) => key.startsWith(`${port}<`));

  return [...declared, ...ancestorsOf(provider, answers).filter((port) => !declared.includes(port) && !subjectOf(port))];
}

function ancestorsOf(provider: ProviderEntry, answers: (name: string) => boolean): string[] {
  const own = provider.name ?? provider.ctor.name;
  const bases: string[] = [];
  for (let base = Object.getPrototypeOf(provider.ctor) as { name?: string } | null; base?.name; base = Object.getPrototypeOf(base) as { name?: string } | null) {
    if (provider.deps.includes(base.name)) return [base.name];
    if (base.name !== own) bases.push(base.name);
  }
  const last = bases.findLastIndex(answers);

  return bases.slice(0, last + 1);
}
