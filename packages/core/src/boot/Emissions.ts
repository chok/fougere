import { applyCreate, dotted, lowerFirst, type SchemaView } from '@fougere/schema';
import type { Container } from '@fougere/container';
import { validationErrorsOf } from '../wire/errors.js';
import { emitKeyOf, factsAnnouncedBy } from '../wire/emit.js';
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

  /** Who FINISHES a fact, in the order they run — see `orderPipes`. */
  private readonly pipes = new Map<string, Listener[]>();

  /** The order its OWNER declared, by fact — `pipes:` in `frond.config.ts`. */
  private readonly ordered: Map<string, string[]>;

  /**
   * What is announced here, read from the DEPS and not from the subscribers: a handler declaring
   * `Emit<PostPublished>` must resolve it whether or not anybody listens, and announcing to nobody
   * is legal.
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
    // Read from the frond that OWNS the fact: ordering is a decision about the fact, and
    // a decision has one owner. A frond ordering a neighbour's fact is refused below.
    this.ordered = new Map(fronds.flatMap((frond) => {
      const owned = new Set(frond.entities.map((entity) => entity.name));

      return Object.entries(frond.pipes ?? {}).map(([fact, order]) => {
        if (!owned.has(lowerFirst(fact))) {
          throw new Error(
            `Frond '${frond.name}' orders the links of '${fact}', which it does not own.\n`
            + '  The order belongs to the frond that declares the entity — state `pipes:` there.',
          );
        }

        return [lowerFirst(fact), order] as const;
      });
    }));
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
        if (bound.source.kind !== 'fact') continue;
        const listeners = this.subscribers.get(bound.source.factName) ?? [];
        listeners.push({ door, op });
        this.subscribers.set(bound.source.factName, listeners);
      }
    }
  }

  /** One more op that finishes this fact. What ORDER they run in is settled at `register`. */
  private claimPipe(fact: string, taking: Listener): void {
    const held = this.pipes.get(fact) ?? [];
    if (held.some((one) => `${one.door}.${one.op}` === `${taking.door}.${taking.op}`)) return;
    held.push(taking);
    this.pipes.set(fact, held);
  }

  /**
   * Put the links in the order their fact's owner declared, and refuse what it did not.
   *
   * Two links with no order refuse: nothing would say which finished the fact, and scan
   * order is not an answer — the same reason two implementations of a port refuse. One
   * link needs no declaration, because there is nothing to order.
   */
  private orderPipes(): void {
    for (const [fact, links] of this.pipes) {
      const declared = this.ordered.get(fact);
      const named = (one: Listener) => `${one.door}.${one.op}`;

      if (!declared) {
        if (links.length < 2) continue;
        throw new Error(
          `${links.length} ops finish the fact '${fact}': ${links.map(named).join(', ')}.\n`
          + '  They run one after another and nothing says in which order. State it on the '
          + `frond that owns '${fact}':\n`
          + `    export default { pipes: { ${fact}: ['FirstHandler', 'SecondHandler'] } };\n`
          + '  Or make all but one accept `Fact<…>`, which changes nothing and reads it.',
        );
      }

      const at = (one: Listener) => declared.findIndex((name) => doorOf(name) === one.door);
      const unlisted = links.filter((one) => at(one) < 0);
      if (unlisted.length > 0) {
        throw new Error(
          `${unlisted.map(named).join(', ')} finish${unlisted.length > 1 ? '' : 'es'} the fact `
          + `'${fact}', and '${fact}' orders ${declared.join(', ')} — so where it runs is not said.\n`
          + '  Add it to `pipes:`, or make it accept `Fact<…>`.',
        );
      }

      this.pipes.set(fact, [...links].sort((one, other) => at(one) - at(other)));
    }
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
    this.orderPipes();
    for (const fact of new Set([...this.announced, ...this.subscribers.keys()])) {
      this.container.registerValue(emitKeyOf(fact), (raw: unknown) => this.announce(fact, raw));
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
    let carried = payload;
    for (const link of this.pipes.get(fact) ?? []) {
      const facade = this.container.resolve<Record<string, Function>>(link.door);
      const answered = await facade[link.op]({ ...Invocation.empty, input: carried });

      // A link that answers nothing SUPPRESSES the fact — every subscriber was then handed
      // `null` and crashed reading it, one message each. It is refused rather than named,
      // because a fact is what HAPPENED: the announcer already said so and cannot be told
      // otherwise, `Emit` returning void. Filtering belongs to whoever announces, or to
      // each reader; it is not a link's to decide for everyone.
      if (answered === null || answered === undefined) {
        throw new Error(
          `${link.door}.${link.op} finishes the fact '${fact}' and answered nothing.\n`
          + '  A link says what the fact IS, it does not take it back — the announcer has '
          + 'already said it happened, and nothing can tell it otherwise.\n'
          + '  Return the fact, amended or as it stands.',
        );
      }
      carried = answered;
    }

    return carried;
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

/**
 * The container key a declared CLASS NAME answers under — `RedactHandler` → `redactHandler`,
 * the same key `facadeKeyOf` builds from an address.
 */
function doorOf(declared: string): string {
  const key = lowerFirst(declared);

  return key.endsWith('Handler') ? key : `${key}Handler`;
}
