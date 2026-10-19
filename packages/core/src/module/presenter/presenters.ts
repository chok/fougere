import type { Container } from '@fougere/container';
import type { Logger } from '../../builtin/Logger.js';
import type { OwnLogger } from '../../builtin/OwnLoggers.js';
import type { FrondDescriptor } from '../../descriptor/FrondDescriptor.js';
import type { HandlerEntry } from '../../descriptor/HandlerEntry.js';
import type { PresenterEntry } from '../../descriptor/PresenterEntry.js';
import type { AnswerStep } from '../../dispatch/AnswerStep.js';
import { exposePresenters, registerPresenters } from './install.js';
import { presented } from './presented.js';
import { lowerFirst } from '@fougere/schema';
import { collectorKeyOf } from '../../prefab/collector.js';

/**
 * Presenters as an extension: their classes in each frond's scope, their computed fields as a step
 * over the answer. The boot installs it beside the schema check and the seeds, so a `Presenter` is
 * never declared with nothing to run it.
 */
/** The two doors an extension answers here — written out, since `Extension` sits in `boot/`, which wires this. */
interface Presenting {
  name: string;
  install(frond: FrondDescriptor, at: { scope: Container; container: Container; ownLogger: OwnLogger; log: Logger }): void;
  steps(handler: HandlerEntry, frond: FrondDescriptor, scope: Container): AnswerStep[];
}

export function presenters(): Presenting {
  const byFrond = new Map<string, Map<string, PresenterEntry>>();

  return {
    name: 'presenters',
    install(frond, { scope, container, ownLogger, log }) {
      const declared = registerPresenters(frond, scope, ownLogger, log);
      exposePresenters(frond, declared, container, scope);
      byFrond.set(frond.name, declared);
    },
    steps(handler, frond, scope) {
      const presenter = byFrond.get(frond.name)?.get(handler.address);
      const asked = (presenter?.fieldMeta ?? []).flatMap((field) => field.params ?? []).map((param) => lowerFirst(param.type.name));
      const collectors = new Set(asked.filter((type) => scope.has(collectorKeyOf(type))));

      return presented(presenter, scope, collectors, handler.address);
    },
  };
}
