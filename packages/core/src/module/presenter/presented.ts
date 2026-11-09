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
 * The computed fields a `Present<Post>` chain adds, before the view projects the rows.
 *
 * Documented: [presenters](https://fougere.dev/docs/data/computed-field).
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

type Chained = Pick<FrondDescriptor, 'name'> & { providers?: readonly Pick<ProviderEntry, 'ctor' | 'deps' | 'implements' | 'filePath'>[] };

type Chaining = Pick<PresenterEntry, 'entityName' | 'fields'> & { ctor?: { name: string } };

/** The fields a chain computes; a field two classes compute is refused. */
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
