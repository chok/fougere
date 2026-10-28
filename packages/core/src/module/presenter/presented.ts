import type { Container } from '@fougere/container';
import { lowerFirst } from '@fougere/schema';
import type { Diagnostic } from '../../diagnostic.js';
import type { FrondDescriptor } from '../../descriptor/FrondDescriptor.js';
import type { PresenterEntry } from '../../descriptor/PresenterEntry.js';
import type { ProviderEntry } from '../../descriptor/ProviderEntry.js';
import type { AnswerStep } from '../../dispatch/AnswerStep.js';
import { collectorKeyOf } from '../../prefab/collector.js';
import { getPresenterFields, presenterKeyOf } from '../../prefab/presenter.js';
import { PresenterExecutor } from './PresenterExecutor.js';
import { presenterArguments, presenterPlans } from './presenterArguments.js';

/**
 * The computed fields a `Present<Post>` chain adds, over the rows the handler answered and BEFORE the
 * view projects them. A presenter runs on the server, so what it reads is the row the storage holds: a
 * `writeOnly` field is gone by the time the client sees it, and deriving from one is the whole reason
 * to declare it. A computed field's parameters and the collectors in scope are both boot-time facts,
 * so the plans are built here once.
 *
 * Documented: [presenters](https://fougere.dev/docs/business/collect-and-present#present--fields-computed-over-the-page).
 */
export function presented(presenter: PresenterEntry | undefined, fields: readonly string[], scope: Container): AnswerStep[] {
  if (!presenter) return [];

  const asked = presenter.fieldMeta.flatMap((field) => field.params ?? []).map((param) => lowerFirst(param.type.name));
  const plans = presenterPlans(presenter, new Set(asked.filter((type) => scope.has(collectorKeyOf(type)))));
  const present: AnswerStep = async (answered, invocation, args) => {
    const executor = new PresenterExecutor(scope.resolve(presenterKeyOf(presenter.entityName)), fields);

    return executor.present(answered, await presenterArguments(plans, invocation, args));
  };

  return [present];
}

/** The fields a `Present<Post>` chain computes — what GraphQL types, beside the boot that runs them. */
export function presentedFields(frond: Chained, presenter: Chaining): string[] {
  return chainFields(frond, presenter, []);
}

/** What a frond is read for to find a chain: its name, and the classes that may stand in front. */
type Chained = Pick<FrondDescriptor, 'name'> & { providers?: readonly Pick<ProviderEntry, 'ctor' | 'deps' | 'implements' | 'filePath'>[] };

/** What a presenter is read for — its entity and its fields, and its class when the refusal names it. */
type Chaining = Pick<PresenterEntry, 'entityName' | 'fields'> & { ctor?: { name: string } };

/**
 * The fields a chain computes: the presenter's, and what each link in front of it in its frond adds —
 * `implements Partial<Present<Post>>` asking for `Present<Post>`. A field two classes of one chain
 * compute is refused, naming both — computed twice, one would silently win.
 */
export function chainFields(frond: Chained, presenter: Chaining, refused: Diagnostic[]): string[] {
  const key = presenterKeyOf(presenter.entityName);
  const links = (frond.providers ?? []).filter((provider) => provider.implements?.includes(key) && provider.deps.includes(key));
  const computedBy = new Map(presenter.fields.map((field) => [field, presenter.ctor?.name ?? 'Present'] as const));
  for (const link of links) {
    for (const field of getPresenterFields(link.ctor)) {
      const first = computedBy.get(field);
      if (first === undefined) {
        computedBy.set(field, link.ctor.name);
        continue;
      }
      refused.push({
        severity: 'blocking',
        code: 'presenter-field-twice',
        frond: frond.name,
        subject: `${presenterKeyOf(presenter.entityName)}.${field}`,
        filePath: link.filePath,
        message: `${first} and ${link.ctor.name} both compute ${field} for ${presenterKeyOf(presenter.entityName)}. Keep it in one of them.`,
      });
    }
  }

  return [...computedBy.keys()];
}
