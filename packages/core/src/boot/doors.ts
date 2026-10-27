import type { Container } from '@fougere/container';
import { Protocols } from '../Protocol.js';
import type { Diagnostic } from '../diagnostic.js';
import { nameOf, type FrondDescriptor } from '../descriptor/FrondDescriptor.js';
import type { DoorAround } from '../entry/door.js';
import type { Plugged } from '../wire/Plugged.js';
import { subjectKeyOf } from '../descriptor/bases.js';

/** What a link at a door stands in front of — the rest of ONE request — and how the door says a refusal. */
const REST = new WeakMap<object, { rest: () => Promise<unknown>; refused: (failure: unknown) => unknown }>();

/** What answers a door's port before anything stands in front of it — the rest of the request. */
export const theRestOfTheRequest = {
  answer(received: object): Promise<unknown> {
    const at = REST.get(received);
    if (!at) throw new Error('A link at a door handed on a request it was not given. Hand the inner what you received.');

    return at.rest();
  },
};

/** The doors whose package names a port — `rest` → `Rest` — read off what registered, never named here. */
export function doorPorts(): { door: string; port: string }[] {
  return Protocols.entries.flatMap(([door, type]) => (type.port ? [{ door, port: type.port }] : []));
}

/** Whether a key is a door's port — `Rest`, or one handler's `Rest<NoteHandler>`. */
export function isDoorPort(key: string): boolean {
  return doorPorts().some(({ port }) => key === port || key.startsWith(`${port}<`));
}

/**
 * At a door, a refusal IS an answer: what a link there throws leaves it as the door's answer, so a link
 * standing outside it still sees one — and adds its headers to a `413` as to a `200`. The door says the
 * refusal in its own terms, and the link writes no `catch` for it.
 */
export function answeringAtDoor(link: object): void {
  const answer = (link as { answer?: (received: object) => Promise<unknown> }).answer;
  if (typeof answer !== 'function') return;
  Object.defineProperty(link, 'answer', {
    configurable: true,
    value: async (received: object) => {
      try {
        return await answer.call(link, received);
      } catch (failure) {
        const at = REST.get(received);
        if (!at) throw failure;

        return at.refused(failure);
      }
    },
  });
}

/**
 * In each frond's scope, the rest of the request under every door's port — `Rest`, for its whole
 * frond — and under the port of each handler — `Rest<NoteHandler>`, for that handler's routes alone.
 */
export function registerDoorPorts(frond: FrondDescriptor, scope: Container, reserve: Reserve): void {
  for (const { port } of doorPorts()) {
    reserve(port, theRestOfTheRequest, `the port of the door every link of ${frond.name} stands in front of`);
    for (const name of new Set(frond.handlers.map((handler) => handler.name))) {
      scope.registerValue(subjectKeyOf(port, name), theRestOfTheRequest);
    }
  }
}

/** Puts what core answers under a key the frond does not choose — or refuses a class of the frond taking it. */
export type Reserve = (key: string, value: unknown, says: string) => void;

/**
 * A bare key core answers in every frond — `Dispatcher`, `Rest` — is not a name a class of the frond may
 * take: it would collide with the rest of the call. A key with a subject cannot collide at all.
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
      message: `${key} is ${says}, so no class of the frond may be called that. Rename the class.`,
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
  const chained = (key: string) => plugged.find((one) => one.frond === frond.name && one.point === key);
  const around = (door: string, key: string) => (received: unknown, next: () => Promise<unknown>, refused: (failure: unknown) => unknown) => {
    if (typeof received !== 'object' || received === null) {
      throw new Error(`The door '${door}' hands its links a ${typeof received}: a link is handed on by what arrived, which must be an object.`);
    }
    REST.set(received, { rest: next, refused });

    return scope.resolve<typeof theRestOfTheRequest>(key).answer(received as object);
  };

  return doorPorts().flatMap(({ door, port }) => {
    const whole = chained(port) ? [{ door, around: around(door, port) }] : [];
    const byHandler = [...new Set(frond.handlers.map((handler) => handler.name))].flatMap((name) => {
      const key = subjectKeyOf(port, name);
      const chain = chained(key);
      if (!chain) return [];
      const served = frond.handlers.filter((handler) => handler.name === name);
      refuseUnknownOps(frond, chain.answers, served.flatMap((handler) => [...handler.operations.keys()]), name, refused);

      return [{ door, around: around(door, key), at: new Set(served.map((handler) => handler.address)) }];
    });

    return [...whole, ...byHandler];
  });
}

function refuseUnknownOps(frond: FrondDescriptor, links: readonly string[], operations: readonly string[], handler: string, refused: Diagnostic[]): void {
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
