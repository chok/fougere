import { type ProviderEntry } from './ProviderEntry.js';
import type { FrondDescriptor } from './FrondDescriptor.js';
import { subjectKeyOf } from '../wire/SubjectKey.js';
import { upperFirst } from '@fougere/schema';

export { subjectKeyOf } from '../wire/SubjectKey.js';

/**
 * What realizes a port core opens with an entity for subject: a collector `Collect<User>`, a presenter
 * `Present<Post>`. Read beside the providers, so a link stands in front of either and `ports:` may name it.
 */
export function realizationsOf(frond: Pick<FrondDescriptor, 'collectors' | 'presenters'>): ProviderEntry[] {
  return [
    ...frond.collectors.map(({ ctor, deps, filePath, typeName }) => ({ ctor, deps, filePath, name: ctor.name, implements: [subjectKeyOf('Collect', upperFirst(typeName))] })),
    ...frond.presenters.map(({ ctor, deps, filePath, entityName }) => ({ ctor, deps, filePath, name: ctor.name, implements: [subjectKeyOf('Present', upperFirst(entityName))] })),
  ];
}

/**
 * Port class name → every concrete class below it, in scan order.
 *
 * ONE condition, and the caller owns it: something already answers under that name. The boot
 * asks its container, where the providers sit in the frond's scope and the builtins in its
 * parent — so a neighbour service and `Logger` both count, a framework class being a port like
 * any other, which is what makes a default overridable.
 *
 * A provider is ranked under the highest ancestor that answers AND under every class it crossed
 * to reach it: a class something extends is a port, declared or not. `StripePayment extends
 * CardPayment extends Payment` answers both, so an abstract `CardPayment` nobody registers is
 * still a key, and a DECLARED abstract one is never a candidate. A wrapper stops at the class it asks for — it stands in front of that one and
 * realizes nothing above it.
 *
 * It is also what keeps a seat out: a repository extends core's `Repository`, under which nothing
 * answers — it answers `Repository<Post>` through its seat (`registerRepositories`), not as a port.
 *
 * Read twice, which is why it is stated once: the boot binds against it, and the scan emits
 * the same relation as types so a config cannot name a class that does not answer the port.
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

/**
 * The ancestors a provider answers under, nearest first, up to the last one that answers — and the
 * ports it states, which no prototype carries: a link asks for the one it implements, and a collector
 * or a presenter realizes `Collect<User>` or `Present<Post>` without asking for it.
 */
function portsOf(provider: ProviderEntry, answers: (name: string) => boolean): string[] {
  const declared = provider.implements ?? [];
  // `extends Rest<NoteHandler>` reads as `Rest` on the prototype and is stated whole: it stands in
  // front of that one, and the bare base is not its port.
  const subjectOf = (port: string) => declared.some((key) => key.startsWith(`${port}<`));

  return [...declared, ...ancestorsOf(provider, answers).filter((port) => !declared.includes(port) && !subjectOf(port))];
}

function ancestorsOf(provider: ProviderEntry, answers: (name: string) => boolean): string[] {
  // A seated class extends the one it was written as (`seated`, `builtOn`), and a class is no port of itself.
  const own = provider.name ?? provider.ctor.name;
  const bases: string[] = [];
  for (let base = Object.getPrototypeOf(provider.ctor) as { name?: string } | null; base?.name; base = Object.getPrototypeOf(base) as { name?: string } | null) {
    if (provider.deps.includes(base.name)) return [base.name];
    if (base.name !== own) bases.push(base.name);
  }
  const last = bases.findLastIndex(answers);

  return bases.slice(0, last + 1);
}
