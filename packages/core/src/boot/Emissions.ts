import { applyCreate, type SchemaView } from '@fougere/schema';
import type { Container } from '@fougere/container';
import { validationErrorsOf } from '../wire/errors.js';
import { emitKeyOf, factsAnnouncedBy } from '../emit.js';
import { ambient } from '#ambient';
import { EMPTY_INVOCATION } from '../contract/Invocation.js';
import type { Logger } from '../builtins/logger.js';
import type { Fronds } from '../descriptor/Fronds.js';
import type { OperationsMap } from '../wire/operation.js';

/** A door and the op on it that accepts a fact. */
interface Listener {
  door: string;
  op: string;
}

/** Carries an announced fact out of this process — see `CreateAppOptions.onEmit`. */
type Carrier = (fact: string, payload: unknown) => void | Promise<void>;

/** Emissions — the only place in Fougere where an initiator names a SUBJECT. */
export class Emissions {
  /** Who listens to what. Filled as each door's contracts are resolved. */
  private readonly subscribers = new Map<string, Listener[]>();

  /** What is announced here, read from the DEPS and not from the subscribers: */
  private readonly announced: Set<string>;

  constructor(
    fronds: Fronds,
    private readonly shapes: Map<string, SchemaView>,
    private readonly container: Container,
    private readonly log: Logger,
    private readonly carry?: Carrier,
  ) {
    this.announced = new Set(fronds.flatMap((frond) => factsAnnouncedBy(frond.handlers)));
  }

  /** Who listens to what — read from the PLAN, where `{ kind: */
  note(contracts: OperationsMap, door: string): void {
    for (const [op, contract] of contracts) {
      for (const bound of contract.binding ?? []) {
        if (bound.source.kind !== 'fact') continue;
        const listeners = this.subscribers.get(bound.source.factName) ?? [];
        listeners.push({ door, op });
        this.subscribers.set(bound.source.factName, listeners);
      }
    }
  }

  /** The shape a fact is judged by, when the fact is a declared entity. */
  shapeOf(fact: string): SchemaView | undefined {
    return this.shapes.get(fact);
  }

  /** The facts this process has a listener for — what a carrier subscribes to on its behalf. */
  listensTo(): string[] {
    return [...this.subscribers.keys()];
  }

  /** Register one emission value per fact — announced here, or merely listened to. */
  register(): void {
    for (const fact of new Set([...this.announced, ...this.subscribers.keys()])) {
      this.container.registerValue(emitKeyOf(fact), (raw: unknown) => this.announce(fact, raw));
    }
    if (ambient.degraded && this.subscribers.size > 0) {
      this.log.warn('no async context on this runtime — an emission ring is not detected');
    }
  }

  /** Announcing. */
  private async announce(fact: string, raw: unknown): Promise<void> {
    /** A fact announced inside a frame that then rolls back is a lie, and nothing can take it back: */
    await ambient.beforeAnnounce(fact);

    const payload = this.stamped(fact, raw);

    /** Whoever is not in this process — and it is the ONLY way to reach them. */
    const delivery = this.carry?.(fact, payload);
    if (delivery) void Promise.resolve(delivery).catch((cause) => this.log.error(`${fact} — carrier refused it`, cause));

    for (const { door, op, done } of this.handToListeners(fact, payload)) {
      void done.catch((cause) => this.log.error(`${fact} → ${door}.${op}`, this.describeRefusal(fact, cause) ?? cause));
    }
  }

  /** Receiving. */
  async deliver(fact: string, payload: unknown): Promise<void> {
    const handed = this.handToListeners(fact, payload);
    const settled = await Promise.allSettled(handed.map((h) => h.done));

    const refused = settled.flatMap((result, i) =>
      result.status === 'rejected' ? [{ ...handed[i], reason: result.reason as unknown }] : []);
    for (const { door, op, reason } of refused) {
      this.log.error(`${fact} → ${door}.${op}`, this.describeRefusal(fact, reason) ?? reason);
    }
    if (refused.length > 0) {
      throw new AggregateError(
        refused.map((r) => r.reason),
        `${fact} — ${refused.length} of ${handed.length} listener(s) refused it`
        + ` (${refused.map((r) => `${r.door}.${r.op}`).join(', ')}).`
        + ` Nothing here holds it: the carrier decides whether it comes back.`,
      );
    }
  }

  /** The announcement realizes the fact's own `lifecycle.create` — a `created()` stamped, an id genera… */
  private stamped(fact: string, raw: unknown): unknown {
    const shape = this.shapes.get(fact);
    return shape && raw !== null && typeof raw === 'object' && !Array.isArray(raw)
      ? applyCreate(shape.getFields(), raw as Record<string, unknown>)
      : raw;
  }

  /** Hand the fact to every listener in THIS process, and give back one promise each. */
  private handToListeners(fact: string, payload: unknown): (Listener & { done: Promise<unknown> })[] {
    const walked = ambient.currentChain();
    if (walked.includes(fact)) {
      throw new Error(
        `Emission cycle: ${[...walked, fact].join(' → ')}.\n`
        + `  A fact cannot cause itself. One of the subscribers above announces a fact that leads back here.`,
      );
    }

    const listeners = this.subscribers.get(fact) ?? [];
    if (listeners.length === 0) {
      this.log.debug(`${fact} — nobody listens in this process`);
      return [];
    }

    return listeners.map(({ door, op }) => ({
      door,
      op,
      done: ambient.enterChain(fact, async () => {
        let facade: Record<string, Function>;
        try {
          facade = this.container.resolve<Record<string, Function>>(door);
        } catch (cause) {
          throw new Error(`${fact} → ${door} could not be reached`, { cause });
        }
        return facade[op]({ ...EMPTY_INVOCATION, body: payload });
      }),
    }));
  }

  /** A subscriber refusing the SHAPE, said in one line instead of dumped as an error. */
  private describeRefusal(fact: string, cause: unknown): string | undefined {
    const refusals = validationErrorsOf(cause);
    if (!refusals?.length) return undefined;
    return `refused the shape — ${refusals.map((d) => `${d.path}: ${d.message}`).join(', ')}.`
      + ` If '${fact}' gained a field, this copy is older than the sender's: re-run \`fougere sync\`.`;
  }
}
