import type { Container } from '@fougere/container';
import type { PresenterEntry } from '../../descriptor/PresenterEntry.js';
import type { AnswerStep } from '../../dispatch/AnswerStep.js';
import { presenterKeyOf } from '../../prefab/presenter.js';
import { PresenterExecutor } from './PresenterExecutor.js';
import { presenterArguments, presenterPlans } from './presenterArguments.js';

/**
 * The computed fields a presenter adds, over the rows the handler answered and BEFORE the view
 * projects them. A presenter runs on the server, so what it reads is the row the storage holds: a
 * `writeOnly` field is gone by the time the client sees it, and deriving from one is the whole
 * reason to declare it. A computed field's parameters and the collectors in scope are both
 * boot-time facts, so the plans are built here once.
 */
export function presented(
  presenter: PresenterEntry | undefined,
  scope: Container,
  collectorTypeNames: ReadonlySet<string>,
  address: string,
): AnswerStep[] {
  if (!presenter) return [];

  const plans = presenterPlans(presenter, collectorTypeNames);
  const present: AnswerStep = async (answered, invocation, args) => {
    const executor = new PresenterExecutor(scope.resolve(presenterKeyOf(address)), presenter.fields);

    return executor.present(answered, await presenterArguments(plans, invocation, args));
  };

  return [present];
}
