import type { Container } from '@fougere/container';
import { lowerFirst } from '@fougere/schema';
import type { Diagnostic } from '../../diagnostic.js';
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

/**
 * The fields a chain computes: the presenter's, and what each link in front of it adds. A field two
 * classes of one chain compute is refused, naming both — computed twice, one would silently win.
 */
export function chainFields(presenter: PresenterEntry, links: readonly ProviderEntry[], frond: string, refused: Diagnostic[]): string[] {
  const computedBy = new Map(presenter.fields.map((field) => [field, presenter.ctor.name] as const));
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
        frond,
        subject: `${presenterKeyOf(presenter.entityName)}.${field}`,
        filePath: link.filePath,
        message: `${first} and ${link.ctor.name} both compute ${field} for ${presenterKeyOf(presenter.entityName)}. Keep it in one of them.`,
      });
    }
  }

  return [...computedBy.keys()];
}
