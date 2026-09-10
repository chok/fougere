import { applyCreate, dotted, type SchemaView } from '@fougere/schema';
import type { Container } from '@fougere/container';
import { validationErrorsOf } from '../wire/errors.js';
import { askKeyOf, emitKeyOf, factsAnnouncedBy, subjectsAskedBy } from '../wire/emit.js';
import { ambient } from '#ambient';
import { Invocation } from '../wire/Invocation.js';
import type { Logger } from '../builtin/logger.js';
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

  /** Who FINISHES a fact — at most one per fact, see `claimPipe`. */
  private readonly pipes = new Map<string, Listener>();

  /** Who ANSWERS a question. Every one of them is asked, and every answer comes back. */
  private readonly responders = new Map<string, Listener[]>();

  /**
   * What is announced here, read from the DEPS and not from the subscribers: a handler declaring
   * `Emit<PostPublished>` must resolve it whether or not anybody listens, and announcing to nobody
   * is legal.
   */
  private readonly announced: Set<string>;

  /** What is asked here, read the same way and for the same reason. */
  private readonly asked: Set<string>;

  constructor(
    fronds: Fronds,
    private readonly shapes: Map<string, SchemaView>,
    private readonly container: Container,
    private readonly log: Logger,
    private readonly carry?: Carrier,
  ) {
    this.announced = new Set(fronds.flatMap((frond) => factsAnnouncedBy(frond.handlers)));
    this.asked = new Set(fronds.flatMap((frond) => subjectsAskedBy(frond.handlers)));
  }

  /**
   * Who listens to what — read from the PLAN, where `{ kind: 'fact' }` is a sentence
   * `computeBindingPlan` already wrote, so nothing re-derives what a parameter is.
   */
  note(contracts: OperationsMap, door: string): void {
    for (const [op, contract] of contracts) {
      for (const bound of contract.binding ?? []) {
        if (bound.source.kind === 'pipe') {
          this.claimPipe(bound.source.factName, { door, op });
          continue;
        }
        if (bound.source.kind === 'answer') {
          const answering = this.responders.get(bound.source.subjectName) ?? [];
          answering.push({ door, op });
          this.responders.set(bound.source.subjectName, answering);
          continue;
        }
        if (bound.source.kind !== 'fact') continue;
        const listeners = this.subscribers.get(bound.source.factName) ?? [];
        listeners.push({ door, op });
        this.subscribers.set(bound.source.factName, listeners);
      }
    }
  }

  /**
   * One link per fact, refused rather than ordered: between two of them nothing says which
   * finishes the fact, and scan order is not an answer — the same reason two
   * implementations of a port refuse and two remotes over one entity refuse.
   */
  private claimPipe(fact: string, taking: Listener): void {
    const held = this.pipes.get(fact);
    if (held && `${held.door}.${held.op}` !== `${taking.door}.${taking.op}`) {
      throw new Error(
        `Two ops finish the fact '${fact}': ${held.door}.${held.op} and ${taking.door}.${taking.op}.\n`
        + '  A fact is the same for every subscriber, so exactly one op may answer it. '
        + 'Merge the two, or make one of them accept `Fact<…>` and change nothing.',
      );
    }
    this.pipes.set(fact, taking);
  }

  /** The shape a fact is validated by, when the fact is a declared entity. */
  shapeOf(fact: string): SchemaView | undefined {
    return this.shapes.get(fact);
  }

  /** The facts this process has a listener for — what a carrier subscribes to on its behalf. */
  listensTo(): string[] {
    return [...this.subscribers.keys()];
  }

  /** The doors that accept one fact — the addresses a middleware must leave alone. */
  doorsFor(fact: string): string[] {
    return (this.subscribers.get(fact) ?? []).map(({ door }) => door);
  }

  /** Register one emission value per fact — announced here, or merely listened to. */
  register(): void {
    for (const fact of new Set([...this.announced, ...this.subscribers.keys()])) {
      this.container.registerValue(emitKeyOf(fact), (raw: unknown) => this.announce(fact, raw));
    }
    for (const subject of new Set([...this.asked, ...this.responders.keys()])) {
      // A carrier publishes to whoever subscribed elsewhere, and nothing comes back — so a
      // subject that has one would answer with only the responders this process knows,
      // silently. Refused here rather than half-answered at the first call.
      if (this.carry) {
        throw new Error(
          `'${subject}' is asked, and this app has a carrier (\`onEmit\`).\n`
          + '  Asking waits for every responder, which means knowing them — a carrier '
          + 'publishes to whoever subscribed elsewhere and brings nothing back, so the '
          + 'answer would be partial and say nothing about it.\n'
          + '  Name the responders in `remotes:`, or announce the subject instead of asking it.',
        );
      }
      this.container.registerValue(askKeyOf(subject), (raw: unknown) => this.ask(subject, raw));
    }
    if (ambient.degraded && this.subscribers.size > 0) {
      this.log.warn('no async context on this runtime — an emission ring is not detected');
    }
  }

  /** Announcing. */
  private async announce(fact: string, raw: unknown): Promise<void> {
    /**
     * A fact announced inside a frame that then rolls back is a lie, and nothing can take it back:
     * announcing is DISPATCH — every subscriber has been handed the fact and the carrier has
     * already put it on the wire — while the frame's writes are still provisional.
     */
    await ambient.beforeAnnounce(fact);

    const payload = await this.finished(fact, this.stamped(fact, raw));

    /** Whoever is not in this process — and it is the ONLY way to reach them. */
    const delivery = this.carry?.(fact, payload);
    if (delivery) void Promise.resolve(delivery).catch((cause) => this.log.error(`${fact} — carrier refused it`, cause));

    for (const { door, op, done } of this.handToListeners(fact, payload)) {
      void done.catch((cause) => this.log.error(`${fact} → ${door}.${op}`, this.describeRefusal(fact, cause) ?? cause));
    }
  }

  /**
   * Asking — the dual of announcing, and the difference is that this one waits.
   *
   * Every responder answers and every answer comes back, so nothing combines them: the
   * asker has them all and decides. A carrier is NOT reached: it publishes to whoever
   * subscribed elsewhere, and you cannot wait for someone whose existence you do not know
   * — refused at boot rather than answered partially in silence.
   */
  private async ask(subject: string, raw: unknown): Promise<unknown[]> {
    const question = this.stamped(subject, raw);
    const asked = this.handToListeners(subject, question, this.responders);
    const settled = await Promise.allSettled(asked.map((one) => one.done));

    // A responder that did not answer REFUSES the question, it does not shrink it: an
    // asker handed the survivors cannot tell three answers from two, and its own law then
    // reads silence as consent. Measured on `demos/ask-quorum` — with billing down, the
    // room billing would have refused was booked.
    const missing = settled.flatMap((result, at) =>
      (result.status === 'rejected' ? [{ ...asked[at]!, reason: result.reason as unknown }] : []));
    if (missing.length > 0) {
      throw new AggregateError(
        missing.map((one) => one.reason),
        `${subject} — ${missing.length} of ${asked.length} responder(s) did not answer`
        + ` (${missing.map((one) => `${one.door}.${one.op}`).join(', ')}).`
        + ' Asking waits for everyone: a partial answer would look like a complete one.',
      );
    }

    return settled.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
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

  /**
   * What the declared link answers, or the value as it stands when nothing declared one.
   *
   * Before anyone is handed anything, and once: every subscriber reads the same fact, which
   * is the whole reason a fact can be said to be what happened. A link that refuses stops
   * the announcement — it was finishing the fact, and half a fact is not one.
   */
  private async finished(fact: string, payload: unknown): Promise<unknown> {
    const link = this.pipes.get(fact);
    if (!link) return payload;

    const facade = this.container.resolve<Record<string, Function>>(link.door);
    return await facade[link.op]({ ...Invocation.empty, input: payload });
  }

  /**
   * The announcement realizes the fact's own `lifecycle.create` — a `created()` stamped, an id
   * generated, a default applied.
   */
  private stamped(fact: string, raw: unknown): unknown {
    const shape = this.shapes.get(fact);
    return shape && raw !== null && typeof raw === 'object' && !Array.isArray(raw)
      ? applyCreate(shape.getFields(), raw as Record<string, unknown>)
      : raw;
  }

  /** Hand the fact to every listener in THIS process, and give back one promise each. */
  private handToListeners(
    fact: string,
    payload: unknown,
    from: Map<string, Listener[]> = this.subscribers,
  ): (Listener & { done: Promise<unknown> })[] {
    const walked = ambient.currentChain();
    if (walked.includes(fact)) {
      throw new Error(
        `Emission cycle: ${[...walked, fact].join(' → ')}.\n`
        + `  A fact cannot cause itself. One of the subscribers above announces a fact that leads back here.`,
      );
    }

    const listeners = from.get(fact) ?? [];
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
        return facade[op]({ ...Invocation.empty, input: payload });
      }),
    }));
  }

  /** A subscriber refusing the SHAPE, said in one line instead of dumped as an error. */
  private describeRefusal(fact: string, cause: unknown): string | undefined {
    const refusals = validationErrorsOf(cause);
    if (!refusals?.length) return undefined;
    return `refused the shape — ${refusals.map((d) => `${dotted(d.path)}: ${d.message}`).join(', ')}.`
      + ` If '${fact}' gained a field, this copy is older than the sender's: re-run \`fougere sync\`.`;
  }
}
