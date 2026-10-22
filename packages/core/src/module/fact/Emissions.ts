import { applyCreate, dotted, lowerFirst, upperFirst, type SchemaView } from '@fougere/schema';
import { addressOf, facadeKeyOf } from '../../wire/Facade.js';
import type { Container } from '@fougere/container';
import { validationErrorsOf } from '../../wire/FougereError.js';
import { awaitKeyOf, emitKeyOf, factsAnnouncedBy, factsAwaitedBy } from '../../wire/Emit.js';
import { ambient } from '#ambient';
import type { Diagnostic } from '../../diagnostic.js';
import { Invocation } from '../../wire/Invocation.js';
import type { Logger } from '../../builtin/Logger.js';
import type { Fronds } from '../../descriptor/Fronds.js';
import type { OperationsMap } from '../../wire/OperationsMap.js';
import type { RemoteListeners } from './RemoteListeners.js';
import { LOG_LINE } from '../../builtin/LogLine.js';

/** The facts being announced up the stack, so a fact cannot cause itself. */
const chain = ambient.slot<readonly string[]>('chain');

/** A facade and the op on it that accepts a fact. */
interface Listener {
  facade: string;
  op: string;
}

/** Carries an announced fact out of this process — see `CreateAppOptions.onEmit`. */
type Carrier = (fact: string, payload: unknown) => void | Promise<void>;

/** Emissions — the only place in Fougere where an initiator names a SUBJECT. */
export class Emissions {
  /** Who listens to what. Filled as each facade's contracts are resolved. */
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

  /** What is announced AND waited for — `Emit<T, A>`, where the second type says so. */
  private readonly awaited: Set<string>;

  /** Where each facade and each frond was written, so a refusal here names a file to open. */
  private readonly fileOf = new Map<string, string>();

  constructor(
    fronds: Fronds,
    private readonly shapes: Map<string, SchemaView>,
    private readonly container: Container,
    private readonly log: Logger,
    private readonly refused: Diagnostic[],
    private readonly carrier?: Carrier,
    private readonly remoteListeners?: RemoteListeners,
  ) {
    for (const frond of fronds) {
      this.fileOf.set(frond.name, frond.source.path);
      for (const handler of frond.handlers) this.fileOf.set(facadeOf(handler.name), handler.filePath);
    }
    this.announced = new Set(fronds.flatMap((frond) => factsAnnouncedBy(frond.handlers)));
    this.awaited = new Set(fronds.flatMap((frond) => factsAwaitedBy(frond.handlers)));
    // Read from the frond that OWNS the fact: ordering is a decision about the fact, and
    // a decision has one owner. A frond ordering a neighbour's fact is refused below.
    this.ordered = new Map(fronds.flatMap((frond) => {
      const owned = new Set(frond.entities.map((entity) => entity.name));

      return Object.entries(frond.pipes ?? {}).map(([fact, order]) => {
        if (!owned.has(lowerFirst(fact))) {
          this.refused.push({
            severity: 'blocking',
            code: 'pipes-not-owned',
            filePath: frond.source.path,
            frond: frond.name,
            subject: fact,
            message: `The frond '${frond.name}' gives an order for ${fact}, but ${fact} is declared in another frond. `
              + 'Move pipes: to the frond.config.ts of that frond.',
          });
        }

        return [lowerFirst(fact), order] as const;
      });
    }));
  }

  /**
   * Who listens to what — read from the PLAN, where `{ kind: 'fact' }` is a sentence
   * `computeBindingPlan` already wrote, so nothing re-derives what a parameter is.
   */
  note(contracts: OperationsMap, facade: string): void {
    for (const [op, contract] of contracts) {
      for (const bound of contract.binding ?? []) {
        if (bound.source.kind === 'pipe') {
          this.addPipe(bound.source.factName, { facade, op });
          continue;
        }
        if (bound.source.kind !== 'fact') continue;
        const listeners = this.subscribers.get(bound.source.factName) ?? [];
        listeners.push({ facade, op });
        this.subscribers.set(bound.source.factName, listeners);
      }
    }
  }

  /** One more op that finishes this fact. What ORDER they run in is settled at `register`. */
  private addPipe(fact: string, taking: Listener): void {
    const pipes = this.pipes.get(fact) ?? [];
    if (pipes.some((one) => `${one.facade}.${one.op}` === `${taking.facade}.${taking.op}`)) return;
    pipes.push(taking);
    this.pipes.set(fact, pipes);
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
      const named = (one: Listener) => `${one.facade}.${one.op}`;

      if (!declared) {
        if (links.length < 2) continue;
        this.refused.push({
          severity: 'blocking',
          code: 'pipes-unordered',
          filePath: this.fileOf.get(links[0]!.facade) ?? '',
          subject: fact,
          message: `${links.map(named).join(' and ')} ${links.length === 2 ? 'both' : 'all'} change ${fact}, in no set order. Give the order in `
            + `frond.config.ts of the frond that owns ${fact}: pipes: { ${fact}: [${links.map((one) => `'${upperFirst(one.facade)}'`).join(', ')}] }. `
            + 'Or, if only one of them changes it, make the others take Fact<…> instead.',
        });
        continue;
      }

      const at = (one: Listener) => declared.findIndex((name) => facadeOf(name) === one.facade);
      const unlisted = links.filter((one) => at(one) < 0);
      if (unlisted.length > 0) {
        this.refused.push({
          severity: 'blocking',
          code: 'pipes-unlisted',
          filePath: this.fileOf.get(unlisted[0]!.facade) ?? '',
          subject: fact,
          message: `${unlisted.map(named).join(', ')} ${unlisted.length > 1 ? 'change' : 'changes'} ${fact}, `
            + `but pipes: for ${fact} lists only ${declared.join(', ')}. Add ${unlisted.length > 1 ? 'them' : 'it'} to pipes:, `
            + 'or make it take Fact<…> if it only reads.',
        });
        continue;
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

  /** The facades that accept one fact — the addresses a middleware must leave alone. */
  facadesFor(fact: string): string[] {
    return (this.subscribers.get(fact) ?? []).map(({ facade }) => facade);
  }

  /**
   * What a listener is handed a fact through: the calls a door makes, never the facade code
   * holds. A fact arrives as the invocation's input and the listener's binding plan places it,
   * wherever it sits in the signature.
   */
  private calls: (facade: string) => Record<string, Function> | undefined = () => undefined;

  /** Register one emission value per fact — announced here, or merely listened to. */
  register(calls: (facade: string) => Record<string, Function> | undefined): void {
    this.calls = calls;
    this.orderPipes();
    for (const fact of new Set([...this.announced, ...this.subscribers.keys()])) {
      this.container.registerValue(emitKeyOf(fact), (raw: unknown) => this.announce(fact, raw));
    }
    for (const fact of this.awaited) {
      // Waiting means knowing WHO, and a carrier publishes to whoever subscribed elsewhere
      // without bringing anything back — so the answers would hold this process's
      // subscribers only, and say nothing about it. Refused here rather than half-answered
      // at the first call: the second type is in a signature, so a boot can read it.
      if (this.carrier) {
        this.refused.push({
          severity: 'blocking',
          code: 'emit-await-with-carrier',
          filePath: this.fileOf.get(facadeOf(fact)) ?? '',
          subject: fact,
          message: `Emit<${fact}, …> waits for answers, but this app sends facts through a carrier (onEmit), `
            + "which brings no answer back. Give the subscribers' fronds an address in `fronds:`, "
            + `or use Emit<${fact}> without the second type.`,
        });
        continue;
      }
      this.container.registerValue(awaitKeyOf(fact), (raw: unknown) => this.announce(fact, raw, true));
    }
    if (ambient.degraded && this.subscribers.size > 0) {
      this.log.warn('This runtime has no async context, so a fact that triggers itself in a loop is not detected. '
        + 'On a Worker, add "nodejs_compat" to compatibility_flags.');
    }
  }

  /** Announcing. */
  private async announce(fact: string, raw: unknown, waiting = false): Promise<unknown[]> {
    /**
     * A fact announced inside a frame that then rolls back is a lie, and nothing can take it back:
     * announcing is DISPATCH — every subscriber has been handed the fact and the carrier has
     * already put it on the wire — while the frame's writes are still provisional.
     */
    await ambient.beforeAnnounce(fact);

    const payload = await this.finished(fact, this.stamped(fact, raw));
    const listeners = [...(this.subscribers.get(fact) ?? []), ...await this.remoteListenersOf(fact, waiting)];

    /** Whoever is not in this process — and it is the ONLY way to reach them. */
    const delivery = this.carrier?.(fact, payload);
    if (delivery) void Promise.resolve(delivery).catch((cause) => this.log.error(`${fact} — carrier refused it`, cause));

    const handed = this.handToListeners(fact, payload, listeners);
    if (!waiting) {
      for (const { facade, op, done } of handed) {
        void done.catch((cause) => this.log.error(`${fact} → ${facade}.${op}`, this.describeRefusal(fact, cause) ?? cause));
      }

      return [];
    }

    return this.answersOf(fact, handed);
  }

  /**
   * A subscriber that did not answer REFUSES the announcement, it does not shrink it: an
   * announcer handed the survivors cannot tell three answers from two, and its own law then
   * reads silence as consent — the room one would have refused gets booked.
   *
   * What answers NOTHING contributes nothing: a subscriber is free to have no opinion, and
   * `Promise<void>` is how it says so.
   */
  private async answersOf(
    fact: string,
    handed: (Listener & { done: Promise<unknown> })[],
  ): Promise<unknown[]> {
    const settled = await Promise.allSettled(handed.map((one) => one.done));

    const missing = settled.flatMap((result, at) =>
      (result.status === 'rejected' ? [{ ...handed[at]!, reason: result.reason as unknown }] : []));
    if (missing.length > 0) {
      for (const { facade, op, reason } of missing) {
        this.log.error(`${fact} → ${facade}.${op}`, this.describeRefusal(fact, reason) ?? reason);
      }

      throw new AggregateError(
        missing.map((one) => one.reason),
        `${fact} — ${missing.length} of ${handed.length} subscriber(s) did not answer`
        + ` (${missing.map((one) => `${one.facade}.${one.op}`).join(', ')}).`
        + ' An announcement with an answer type waits for everyone: a partial answer would'
        + ' look like a complete one.',
      );
    }

    return settled.flatMap((result) =>
      (result.status === 'fulfilled' && result.value != null ? [result.value] : []));
  }

  /** Receiving. */
  async deliver(fact: string, payload: unknown): Promise<void> {
    const handed = this.handToListeners(fact, payload);
    const settled = await Promise.allSettled(handed.map((h) => h.done));

    const refused = settled.flatMap((result, i) =>
      result.status === 'rejected' ? [{ ...handed[i], reason: result.reason as unknown }] : []);
    for (const { facade, op, reason } of refused) {
      this.log.error(`${fact} → ${facade}.${op}`, this.describeRefusal(fact, reason) ?? reason);
    }
    if (refused.length > 0) {
      throw new AggregateError(
        refused.map((r) => r.reason),
        `${fact} — ${refused.length} of ${handed.length} listener(s) refused it`
        + ` (${refused.map((r) => `${r.facade}.${r.op}`).join(', ')}).`
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
    let current = payload;
    for (const link of this.pipes.get(fact) ?? []) {
      const answer = await this.reach(link.facade, fact)[link.op]({ ...Invocation.empty, input: current });

      // A link that answers nothing SUPPRESSES the fact — every subscriber was then handed
      // `null` and crashed reading it, one message each. It is refused rather than named,
      // because a fact is what HAPPENED: the announcer already said so and cannot be told
      // otherwise, `Emit` returning void. Filtering belongs to whoever announces, or to
      // each reader; it is not a link's to decide for everyone.
      if (answer === null || answer === undefined) {
        throw new Error(
          `${link.facade}.${link.op} takes Pipe<${fact}> and returned nothing. `
          + 'It must return the fact, changed or as it is.',
        );
      }
      current = answer;
    }

    return current;
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

  /**
   * The listeners another process serves, read off its card — minus those already noted here,
   * since a remote frond whose code this process read is noted twice.
   *
   * A line never crosses: delivering it is a call, and a call writes lines.
   */
  private async remoteListenersOf(fact: string, waiting: boolean): Promise<Listener[]> {
    if (!this.remoteListeners || fact === LOG_LINE) return [];

    const { listeners, unreachable } = await this.remoteListeners.listenersOf(fact);
    if (unreachable.length > 0) {
      const unknown = `${fact}: ${unreachable.join(', ')} did not answer`;
      if (waiting) throw new Error(`${unknown}, so its subscribers could not be asked. Emit<${fact}, …> needs every answer.`);
      this.log.warn(`${unknown}, so its subscribers did not receive the fact.`);
    }

    const here = new Set((this.subscribers.get(fact) ?? []).map(({ facade, op }) => `${facade}.${op}`));

    return listeners
      .map(({ address, op }) => ({ facade: facadeKeyOf(address), op }))
      .filter(({ facade, op }) => !here.has(`${facade}.${op}`));
  }

  /** Hand the fact to every listener named, those of THIS process when none are, and give back one promise each. */
  private handToListeners(
    fact: string,
    payload: unknown,
    listeners: Listener[] = this.subscribers.get(fact) ?? [],
  ): (Listener & { done: Promise<unknown> })[] {
    const walked = chain.current() ?? [];
    if (walked.includes(fact)) {
      throw new Error(
        `Facts announced in a loop: ${[...walked, fact].join(' → ')}. `
        + 'One of these subscribers announces a fact that leads back here. Announce it somewhere else.',
      );
    }

    if (listeners.length === 0) {
      this.log.debug(`${fact} — nobody listens`);

      return [];
    }

    return listeners.map(({ facade, op }) => ({
      facade,
      op,
      done: chain.within([...walked, fact], async () => {
        return this.reach(facade, fact)[op]({ ...Invocation.empty, input: payload });
      }),
    }));
  }

  private reach(facade: string, fact: string): Record<string, Function> {
    const calls = this.calls(facade);
    if (!calls) throw new Error(`${fact} → ${facade} could not be reached`);

    return calls;
  }

  /** A subscriber refusing the SHAPE, said in one line instead of dumped as an error. */
  private describeRefusal(fact: string, cause: unknown): string | undefined {
    const refusals = validationErrorsOf(cause);
    if (!refusals?.length) return undefined;

    return `refused the shape — ${refusals.map((d) => `${dotted(d.path)}: ${d.message}`).join(', ')}.`
      + ` If '${fact}' gained a field, this copy is older than the sender's: re-run \`fougere sync\`.`;
  }
}

/** The container key a declared CLASS NAME answers under — `RedactHandler` → `redactHandler`. */
function facadeOf(declared: string): string {
  return facadeKeyOf(addressOf(declared));
}
