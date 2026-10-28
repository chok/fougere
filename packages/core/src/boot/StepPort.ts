import type { Container } from '@fougere/container';
import type { FrondDescriptor } from '../descriptor/FrondDescriptor.js';
import type { Plugged } from '../wire/Plugged.js';
import { subjectKeyOf } from '../descriptor/bases.js';

/** What a step was handed for one value it carries: the rest of the step, and how its door says a refusal. */
interface Handed {
  next: () => Promise<unknown>;
  refused?: (failure: unknown) => unknown;
}

/** Where a step's chain stands: its key, and the addresses of the one handler it is bound to — none for the frond. */
export interface Standing {
  key: string;
  at?: ReadonlySet<string>;
}

/**
 * The port of a STEP — `Dispatcher` around a call, `Rest` around a REST request — whose realization is the
 * rest of that step. Bare, it stands around every one of its frond; `Dispatcher<PostHandler>` around that
 * handler's alone. A link hands on the value it was given, and the innermost reaches the rest.
 *
 * Documented: [ports](https://fougere.dev/docs/business/ports).
 */
export class StepPort {
  private readonly handed = new WeakMap<object, Handed>();
  /** What answers the port before anything stands in front of it. */
  readonly rest: Record<string, (value: object) => Promise<unknown>>;

  constructor(
    readonly port: string,
    readonly gesture: string,
    /** What a chain reaches last, as `fougere ports` says it. */
    readonly innermost: string,
  ) {
    this.rest = {
      [gesture]: (value) => {
        const at = this.handed.get(value);
        if (!at) throw new Error(`A link in front of ${port} handed on a value it was not given. Hand the inner what you received.`);

        return at.next();
      },
    };
  }

  /** Whether a key is this port — bare, or bound to a handler. */
  covers(key: string): boolean {
    return key === this.port || key.startsWith(`${this.port}<`);
  }

  /** The rest of the step under the bare key, which a class of the frond may not take, and under each handler's. */
  register(frond: FrondDescriptor, scope: Container, reserve: (key: string, value: unknown, says: string) => void): void {
    reserve(this.port, this.rest, this.innermost);
    for (const name of handlerNames(frond)) scope.registerValue(subjectKeyOf(this.port, name), this.rest);
  }

  /** What stands at this step for the frond once its links are chained — the frond's chain first, then each handler's. */
  standing(frond: FrondDescriptor, plugged: readonly Plugged[]): Standing[] {
    const chained = (key: string) => plugged.some((one) => one.frond === frond.name && one.point === key);
    const byHandler = [...handlerNames(frond)].flatMap((name) => {
      const key = subjectKeyOf(this.port, name);

      return chained(key) ? [{ key, at: new Set(frond.handlers.filter((one) => one.name === name).map((one) => one.address)) }] : [];
    });

    return [...(chained(this.port) ? [{ key: this.port }] : []), ...byHandler];
  }

  /** Hands one value to the chain under `key`, its innermost reaching `next`. */
  hand(scope: Container, key: string, value: object, next: () => Promise<unknown>, refused?: (failure: unknown) => unknown): Promise<unknown> {
    this.handed.set(value, { next, ...(refused && { refused }) });

    return scope.resolve<StepPort['rest']>(key)[this.gesture]!(value);
  }

  /** How the door a value arrived at says a refusal — what a link there answers instead of throwing. */
  refusedAt(value: object): ((failure: unknown) => unknown) | undefined {
    return this.handed.get(value)?.refused;
  }
}

function handlerNames(frond: FrondDescriptor): Set<string> {
  return new Set(frond.handlers.map((handler) => handler.name));
}
