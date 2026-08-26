import { applyCreate, type SchemaView } from '@fougere/schema';
import type { Container } from '@fougere/container';
import { validationErrorsOf } from '../wire/errors.js';
import { emitKeyOf, factsAnnouncedBy } from '../emit.js';
import { ambient } from '#ambient';
import { EMPTY_INVOCATION } from '../wire/invocation.js';
import type { Logger } from '../builtins/logger.js';
import type { Fronds } from '../scan/Fronds.js';
import type { OperationsMap } from '../wire/operation.js';

/** A door and the op on it that accepts a fact. */
interface Listener {
  door: string;
  op: string;
}

/** Carries an announced fact out of this process — see `CreateAppOptions.onEmit`. */
type Carrier = (fact: string, payload: unknown) => void | Promise<void>;

/**
 * Emissions — the only place in Fougere where an initiator names a SUBJECT.
 *
 * It was eight closures over four collections in the middle of the boot, which is a
 * class that had not been named: the announced set, the subscriber index, the chain
 * carried in async context, and the shapes a fact is judged against.
 *
 * **It is a resolver, not a channel.** It answers *who*, then hands over to the door
 * that already exists — so a subscriber keeps its judge, its binding and its
 * middlewares, and nothing here is durable.
 */
export class Emissions {
  /** Who listens to what. Filled as each door's contracts are resolved. */
  private readonly subscribers = new Map<string, Listener[]>();

  /**
   * What is announced here, read from the DEPS and not from the subscribers: a handler
   * declaring `Emit<PostPublished>` must resolve it whether or not anybody listens, and
   * announcing to nobody is legal.
   */
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

  /**
   * Who listens to what — read from the PLAN, where `{ kind: 'fact' }` is a sentence
   * `computeBindingPlan` already wrote, so nothing re-derives what a parameter is.
   *
   * It is called for a frond hosted here AND for one declared remote. A remote frond is
   * still scanned — only its hosting is elsewhere — so its subscriptions are known, and
   * its door resolves to a doublure. That is the whole reason an emission crosses a
   * process without a line of transport code: the emitter learned the signature locally
   * and calls the same key. Noting only the hosted ones left the index EMPTY under a
   * split, and a fact announced to a remote listener reached nobody, in silence.
   */
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

  /**
   * Register one emission value per fact — announced here, or merely listened to.
   *
   * A process that only subscribes still needs the value, because `deliver` is what a
   * carrier calls and it goes through the same door. Called once every door has been
   * built, so the two sets are complete.
   */
  register(): void {
    for (const fact of new Set([...this.announced, ...this.subscribers.keys()])) {
      this.container.registerValue(emitKeyOf(fact), (raw: unknown) => this.announce(fact, raw));
    }
    if (ambient.degraded && this.subscribers.size > 0) {
      this.log.warn('no async context on this runtime — an emission ring is not detected');
    }
  }

  /**
   * Announcing. Dispatch, never delivery — the emitter is handed back the moment every
   * subscriber has been HANDED the fact, not when any of them is done.
   *
   * The `EventBus` this replaces did `await Promise.all(handlers)` and passed their
   * rejections up, which made a publication hostage to its own indexer.
   */
  private async announce(fact: string, raw: unknown): Promise<void> {
    /**
     * A fact announced inside a frame that then rolls back is a lie, and nothing can take
     * it back: announcing is DISPATCH — every subscriber has been handed the fact and the
     * carrier has already put it on the wire — while the frame's writes are still
     * provisional.
     *
     * Refused rather than deferred to the commit. Deferring would make `Emit<T>` behave
     * differently depending on where it is called from, which is the hidden runtime the
     * doctrine refuses; and it opens a window between the commit and the announcement whose
     * only remedy is an outbox — a table, therefore durability, the one thing Fougere says
     * it does not hold.
     *
     * A fact designates something that HAS happened. `run` returning is when that becomes
     * true, so that is where the announcement belongs.
     */
    await ambient.beforeAnnounce(fact);

    const payload = this.stamped(fact, raw);

    /**
     * Whoever is not in this process — and it is the ONLY way to reach them.
     *
     * The local dispatch finds its listeners by having READ their code, so it stops at
     * the repository boundary: another team's Frond is not on this disk, and the
     * emission reaches nobody. A carrier hands the fact to a name instead, and the far
     * side subscribes to that same name from ITS own code. Neither reads the other.
     *
     * `deliver` deliberately does NOT come here: a hub that resolved this value to hand
     * on an incoming reading echoed it straight back to the whole fleet.
     */
    const carried = this.carry?.(fact, payload);
    if (carried) void Promise.resolve(carried).catch((cause) => this.log.error(`${fact} — carrier refused it`, cause));

    for (const { door, op, done } of this.handToListeners(fact, payload)) {
      void done.catch((cause) => this.log.error(`${fact} → ${door}.${op}`, this.describeRefusal(fact, cause) ?? cause));
    }
  }

  /**
   * Receiving. **The opposite rule, deliberately**: this one waits, and it tells.
   *
   * `deliver` is what a CARRIER calls, and a carrier's whole job is to know whether the
   * fact landed — at-least-once is retrying what failed, so a delivery that cannot report
   * makes durability impossible to build on top. It used to be the announcement itself:
   * it resolved before any subscriber had run and swallowed every failure into a log, so a
   * queue calling it could only ever ack blindly.
   *
   * That is not a contradiction of "dispatch is not delivery". That rule protects the
   * EMITTER, which must not become hostage to a subscriber; a carrier is not the emitter,
   * it is precisely the party whose business this is.
   *
   * What it still does not do is HOLD anything. A fact refused here is refused, and the
   * carrier decides whether it comes back — which is the whole of Fougere's position on
   * durability: the channel goes underneath, it is not reimplemented here.
   */
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

  /**
   * The announcement realizes the fact's own `lifecycle.create` — a `created()` stamped,
   * an id generated, a default applied.
   *
   * `applyCreate` (`schema/src/axis/lifecycle/apply.ts`) is where the split is realized:
   * the judge never fills a hole, the STORAGE does, at the point of persistence. A fact has no storage, so nobody did — the judge declared an
   * absent `created()` legal and omitted it, and a subscriber received a value missing a
   * field its own type promises. Announcing is a fact's point of persistence.
   *
   * Announcing only, never `deliver`: a fact that arrives from elsewhere was stamped by
   * its sender, and stamping it again would give one fact a different identity in every
   * process that relayed it.
   *
   * **A typed emitter cannot reach this yet.** `Emit<T>` names the ROW type, where a
   * `created()` field is present and required, so `announce({ id, title })` is a compile
   * error and the author writes `at: new Date()` anyway. So this runs for a payload built
   * outside the type — a bridge, a replay, a test — and is inert for everyone else.
   */
  private stamped(fact: string, raw: unknown): unknown {
    const shape = this.shapes.get(fact);
    return shape && raw !== null && typeof raw === 'object' && !Array.isArray(raw)
      ? applyCreate(shape.getFields(), raw as Record<string, unknown>)
      : raw;
  }

  /**
   * Hand the fact to every listener in THIS process, and give back one promise each.
   *
   * The call goes THROUGH the door, so a subscriber meets the same judge, the same binding
   * and the same middlewares as any caller. Nothing new answers for correctness — that is
   * the dividend of a subscriber being an ordinary op rather than a special kind.
   *
   * It returns the promises rather than settling them, because the two callers want
   * opposite things and only one of them is wrong to wait.
   */
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

  /**
   * A subscriber refusing the SHAPE, said in one line instead of dumped as an error.
   *
   * This is the one refusal nobody else will ever see. A door hands its 400 back to the
   * caller who can fix it; a fact is dispatched, not delivered, so the sender learns
   * nothing and the log is the whole of the evidence. The most likely cause is also the
   * one a stack trace hides worst — this process's copy is older than the sender's — so
   * the line names the fields and the remedy, and hedges because a genuinely bad payload
   * produces the same refusal.
   */
  private describeRefusal(fact: string, cause: unknown): string | undefined {
    const refusals = validationErrorsOf(cause);
    if (!refusals?.length) return undefined;
    return `refused the shape — ${refusals.map((d) => `${d.path}: ${d.message}`).join(', ')}.`
      + ` If '${fact}' gained a field, this copy is older than the sender's: re-run \`fougere sync\`.`;
  }
}
