import { applyCreate, dotted, lowerFirst, upperFirst, type SchemaView } from '@fougere/schema';
import { addressOf, facadeKeyOf } from '../../wire/Facade.js';
import { subjectsOf } from '../../wire/SubjectKey.js';
import type { Container } from '@fougere/container';
import { validationErrorsOf } from '../../wire/FougereError.js';
import { awaitKeysIn, emitKeyOf, factOfAwaitKey, factsAnnouncedBy, factsAwaitedBy } from '../../wire/Emit.js';
import { ambient } from '#ambient';
import type { Diagnostic } from '../../diagnostic.js';
import { Invocation } from '../../wire/Invocation.js';
import type { Logger } from '../../builtin/Logger.js';
import type { Fronds } from '../../descriptor/Fronds.js';
import type { OperationsMap } from '../../wire/OperationsMap.js';
import type { RemoteListeners } from './RemoteListeners.js';
import { LOG_LINE } from '../../builtin/LogLine.js';

const chain = ambient.slot<readonly string[]>('chain');

interface Listener {
  facade: string;
  op: string;
}

type Carrier = (fact: string, payload: unknown) => void | Promise<void>;

/** Emissions — the only place in Fougere where an initiator names a SUBJECT. */
export class Emissions {
  private readonly subscribers = new Map<string, Listener[]>();

  private readonly pipes = new Map<string, Listener[]>();

  private readonly ordered: Map<string, string[]>;

  private readonly announced: Set<string>;

  private readonly awaited: Set<string>;
  private readonly awaitKeys: string[];

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
    this.awaitKeys = fronds.flatMap((frond) => awaitKeysIn(frond.handlers));
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

  /** Who listens to what, read from the binding plans. */
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

  private addPipe(fact: string, taking: Listener): void {
    const pipes = this.pipes.get(fact) ?? [];
    if (pipes.some((one) => `${one.facade}.${one.op}` === `${taking.facade}.${taking.op}`)) return;
    pipes.push(taking);
    this.pipes.set(fact, pipes);
  }

  private orderPipes(): void {
    for (const [fact, links] of this.pipes) {
      const declared = this.ordered.get(fact);

      if (!declared) {
        if (links.length < 2) continue;
        this.refused.push({
          severity: 'blocking',
          code: 'pipes-unordered',
          filePath: this.fileOf.get(links[0]!.facade) ?? '',
          subject: fact,
          message: `${links.map(namedOf).join(' and ')} ${links.length === 2 ? 'both' : 'all'} change ${fact}, in no set order. Give the order in `
            + `frond.config.ts of the frond that owns ${fact}: pipes: { ${fact}: [${links.map((one) => `'${subjectsOf(one.facade, 'Facade')![0]}'`).join(', ')}] }. `
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
          message: `${unlisted.map(namedOf).join(', ')} ${unlisted.length > 1 ? 'change' : 'changes'} ${fact}, `
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

  private calls: (facade: string) => Record<string, Function> | undefined = () => undefined;

  /** Register one emission value per fact — announced here, or merely listened to. */
  register(calls: (facade: string) => Record<string, Function> | undefined): void {
    this.calls = calls;
    this.orderPipes();
    for (const fact of new Set([...this.announced, ...this.subscribers.keys()])) {
      this.container.registerValue(emitKeyOf(fact), (raw: unknown) => this.announce(fact, raw));
    }
    for (const fact of this.awaited) {
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
      for (const key of this.awaitKeys.filter((one) => factOfAwaitKey(one) === fact)) {
        this.container.registerValue(key, (raw: unknown) => this.announce(fact, raw, true));
      }
    }
    if (ambient.degraded && this.subscribers.size > 0) {
      this.log.warn('This runtime has no async context, so a fact that triggers itself in a loop is not detected. '
        + 'On a Worker, add "nodejs_compat" to compatibility_flags.');
    }
  }

  private async announce(fact: string, raw: unknown, waiting = false): Promise<unknown[]> {
    await ambient.beforeAnnounce(fact);

    const payload = await this.finished(fact, this.stamped(fact, raw));
    const listeners = [...(this.subscribers.get(fact) ?? []), ...await this.remoteListenersOf(fact, waiting)];

    const delivery = this.carrier?.(fact, payload);
    if (delivery) void Promise.resolve(delivery).catch((cause) => this.log.error(`${fact} — carrier refused it`, cause));

    const handed = this.handToListeners(fact, payload, listeners);
    if (!waiting) {
      for (const { facade, op, done } of handed) {
        void done.catch((cause) => this.log.error(`${fact} → ${namedOf({ facade, op })}`, this.describeRefusal(fact, cause) ?? cause));
      }

      return [];
    }

    return this.answersOf(fact, handed);
  }

  private async answersOf(
    fact: string,
    handed: (Listener & { done: Promise<unknown> })[],
  ): Promise<unknown[]> {
    const settled = await Promise.allSettled(handed.map((one) => one.done));

    const missing = settled.flatMap((result, at) =>
      (result.status === 'rejected' ? [{ ...handed[at]!, reason: result.reason as unknown }] : []));
    if (missing.length > 0) {
      for (const { facade, op, reason } of missing) {
        this.log.error(`${fact} → ${namedOf({ facade, op })}`, this.describeRefusal(fact, reason) ?? reason);
      }

      throw new AggregateError(
        missing.map((one) => one.reason),
        `${fact} — ${missing.length} of ${handed.length} subscriber(s) did not answer`
        + ` (${missing.map(namedOf).join(', ')}).`
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
      this.log.error(`${fact} → ${namedOf({ facade, op })}`, this.describeRefusal(fact, reason) ?? reason);
    }
    if (refused.length > 0) {
      throw new AggregateError(
        refused.map((r) => r.reason),
        `${fact} — ${refused.length} of ${handed.length} listener(s) refused it`
        + ` (${refused.map(namedOf).join(', ')}).`
        + ` Nothing here holds it: the carrier decides whether it comes back.`,
      );
    }
  }

  private async finished(fact: string, payload: unknown): Promise<unknown> {
    let current = payload;
    for (const link of this.pipes.get(fact) ?? []) {
      const answer = await this.reach(link.facade, fact)[link.op]({ ...Invocation.empty, input: current });

      if (answer === null || answer === undefined) {
        throw new Error(
          `${namedOf(link)} takes Pipe<${fact}> and returned nothing. `
          + 'It must return the fact, changed or as it is.',
        );
      }
      current = answer;
    }

    return current;
  }

  private stamped(fact: string, raw: unknown): unknown {
    const shape = this.shapes.get(fact);

    return shape && raw !== null && typeof raw === 'object' && !Array.isArray(raw)
      ? applyCreate(shape.getFields(), raw as Record<string, unknown>)
      : raw;
  }

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

  private describeRefusal(fact: string, cause: unknown): string | undefined {
    const refusals = validationErrorsOf(cause);
    if (!refusals?.length) return undefined;

    return `refused the shape — ${refusals.map((d) => `${dotted(d.path)}: ${d.message}`).join(', ')}.`
      + ` If '${fact}' gained a field, this copy is older than the sender's: re-run \`fougere sync\`.`;
  }
}

/** The container key a declared CLASS NAME answers under — `RedactHandler` → `redactHandler`. */
function namedOf(listener: Listener): string {
  return `${addressOf(listener.facade)}.${listener.op}`;
}

function facadeOf(declared: string): string {
  return facadeKeyOf(addressOf(declared));
}
