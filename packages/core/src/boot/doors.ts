import type { Container } from '@fougere/container';
import { Protocols } from '../Protocol.js';
import type { Diagnostic } from '../diagnostic.js';
import { nameOf, type FrondDescriptor } from '../descriptor/FrondDescriptor.js';
import type { DoorAround } from '../entry/door.js';
import type { Plugged } from '../wire/Plugged.js';
import { StepPort } from './StepPort.js';

/** One step per door whose package names a port — `rest` → `Rest` — read off what registered, never named here. */
const STEPS = new Map<string, StepPort>();

export function doorPorts(): { door: string; step: StepPort }[] {
  return Protocols.entries.flatMap(([door, type]) => {
    if (!type.port) return [];
    const step = STEPS.get(type.port) ?? new StepPort(type.port, 'answer', 'the rest of the request');
    STEPS.set(type.port, step);

    return [{ door, step }];
  });
}

/** The door step a key is — `Rest`, or one handler's `Rest<NoteHandler>` — if it is one. */
export function doorStepOf(key: string): StepPort | undefined {
  return doorPorts().find(({ step }) => step.covers(key))?.step;
}

/**
 * At a door, a refusal IS an answer: what a link there throws leaves it as the door's answer, so a link
 * standing outside it still sees one — and adds its headers to a `413` as to a `200`. The door says the
 * refusal in its own terms, and the link writes no `catch` for it.
 */
export function answeringAtDoor(link: object, step: StepPort): void {
  const answer = (link as { answer?: (received: object) => Promise<unknown> }).answer;
  if (typeof answer !== 'function') return;
  Object.defineProperty(link, 'answer', {
    configurable: true,
    value: async (received: object) => {
      try {
        return await answer.call(link, received);
      } catch (failure) {
        const refused = step.refusedAt(received);
        if (!refused) throw failure;

        return refused(failure);
      }
    },
  });
}

/** Puts what core answers under a key the frond does not choose — or refuses a class of the frond taking it. */
export type Reserve = (key: string, value: unknown, says: string) => void;

/**
 * A bare key core answers in every frond — `Dispatcher`, `Rest` — is not a name a class of the frond may
 * take: it would collide with the rest of the step. A key with a subject cannot collide at all.
 */
export function reserving(frond: FrondDescriptor, scope: Container, refused: Diagnostic[]): Reserve {
  const taken = new Map(frond.providers.map((provider) => [nameOf(provider), provider] as const));

  return (key, value, says) => {
    const provider = taken.get(key);
    if (!provider) {
      scope.registerValue(key, value);

      return;
    }
    refused.push({
      severity: 'blocking',
      code: 'port-key-taken',
      frond: frond.name,
      subject: key,
      filePath: provider.filePath,
      message: `${key} answers ${says} in every frond, so no class of the frond may be called that. Rename the class.`,
    });
  };
}

/**
 * What stands at a door for this frond, once its links are chained: the frond's whole chain, and each
 * handler's at that handler's addresses. A method of a handler's link naming no op of it is refused —
 * a misspelt op would stand around nothing.
 *
 * Documented: [surfaces](https://fougere.dev/docs/infra/surfaces).
 */
export function standingAtDoors(
  frond: FrondDescriptor,
  scope: Container,
  plugged: readonly Plugged[],
  refused: Diagnostic[],
): (DoorAround & { at?: ReadonlySet<string> })[] {
  return doorPorts().flatMap(({ door, step }) => step.standing(frond, plugged).map(({ key, at }) => {
    if (at) refuseUnknownOps(frond, plugged, key, refused);

    return {
      door,
      ...(at && { at }),
      around: (received: unknown, next: () => Promise<unknown>, refusing: (failure: unknown) => unknown) => {
        if (typeof received !== 'object' || received === null) {
          throw new Error(`The door '${door}' hands its links a ${typeof received}: a link is handed on by what arrived, which must be an object.`);
        }

        return step.hand(scope, key, received, next, refusing);
      },
    };
  }));
}

function refuseUnknownOps(frond: FrondDescriptor, plugged: readonly Plugged[], key: string, refused: Diagnostic[]): void {
  const links = plugged.find((one) => one.frond === frond.name && one.point === key)?.answers ?? [];
  const handler = key.slice(key.indexOf('<') + 1, -1);
  const operations = frond.handlers.filter((one) => one.name === handler).flatMap((one) => [...one.operations.keys()]);
  for (const provider of frond.providers.filter((one) => links.includes(nameOf(one)))) {
    const prototype = provider.ctor.prototype as Record<string, unknown>;
    for (const method of Object.getOwnPropertyNames(prototype)) {
      if (method === 'constructor' || method === 'answer' || typeof prototype[method] !== 'function' || operations.includes(method)) continue;
      refused.push({
        severity: 'blocking',
        code: 'door-link-unknown-op',
        frond: frond.name,
        subject: `${nameOf(provider)}.${method}`,
        filePath: provider.filePath,
        message: `${nameOf(provider)}.${method} names no operation of ${handler}, which serves ${operations.join(', ')}. `
          + 'Name the method after the operation it stands around.',
      });
    }
  }
}
