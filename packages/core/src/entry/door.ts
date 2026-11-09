import { DoorEvent } from '../dispatch/DoorEvent.js';
import type { DispatchLifecycle } from '../dispatch/DispatchLifecycle.js';
import { DoorRequest } from '../wire/DoorRequest.js';
import type { Keeping } from '../module/state/keeping.js';
import type { DeclaredState } from '../module/state/States.js';
import type { StateKeeper } from '../module/state/StateKeeper.js';
import { ErrorCode } from '../wire/ErrorCode.js';
import { FougereError } from '../wire/FougereError.js';
import { toPublicError } from '../wire/http-error.js';

/** What a door's calls answered, or the refusal it is to say instead — already fit for its caller. */
export type DoorOutcome = { answered: unknown } | { refused: FougereError };

/**
 * A way in, as the package that brings it writes it.
 *
 * Documented: [surfaces](https://fougere.dev/docs/serve/rest-graphql).
 */
export interface Door<Received, Decoded, Answer> {
  /** The package's word for it — `rest`, `graphql` — which core never reads but to say where. */
  readonly name: string;
  /** Its caller is the operator, so a refusal reaches it whole. */
  readonly trusted?: boolean;
  /** The one address it answers for, when it answers for one. */
  readonly address?: string;
  /**
   * What it carries a caller's state in.
   * Ex: `http`.
   */
  readonly carries?: string;
  carrier?(received: Received): unknown;
  /** What arrived, made into what the calls need — within `maxBodyBytes`, whatever the door. */
  decode(received: Received): Promise<Decoded>;
  /** The calls a request makes — one, or several for a document that asks for several things. */
  run(decoded: Decoded): Promise<unknown>;
  /** The outcome in the door's own shape — a status, an `errors` list, a frame — beside what arrived. */
  encode(outcome: DoorOutcome, received: Received, carrier?: unknown): Answer;
}

/** Running one request through a door — `app.answer`, or `answerAt` for a host holding no app. */
export type Answering = <Received, Decoded, Answer>(door: Door<Received, Decoded, Answer>, received: Received) => Promise<Answer>;

/** A door middleware as the cycle runs it: the door it stands at, and its `around`. */
export interface DoorAround {
  door: string;
  /** `refused` turns a failure into the door's answer — what a link at the door is handed instead of a throw. */
  around(received: unknown, next: () => Promise<unknown>, refused: (failure: unknown) => unknown): Promise<unknown>;
}

/** What the cycle needs of the app: where a request is entered, who watches it, who stands around it. */
export interface DoorCycle {
  enterRequest<R>(request: DoorRequest, fn: () => Promise<R>): Promise<R>;
  lifecycle: Pick<DispatchLifecycle, 'publish' | 'observed'>;
  /** The door middlewares the frond of an address declared, outermost first. */
  middlewaresAt?(address: string): readonly DoorAround[];
  /** What `state:` declares, the seal its values travel under, and where a keeper's rows are. */
  keeping?: Keeping;
}

const UNWATCHED: DoorCycle = { enterRequest: (_request, fn) => fn(), lifecycle: { publish: () => {}, observed: () => false } };

/** The one cycle every door runs. */
export function answerAt<Received, Decoded, Answer>(
  door: Door<Received, Decoded, Answer>,
  received: Received,
  { enterRequest, lifecycle, middlewaresAt, keeping }: DoorCycle = UNWATCHED,
): Promise<Answer> {
  const request = DoorRequest.open(door.name);

  return enterRequest(request, async () => {
    const watched = lifecycle.observed();
    if (watched) lifecycle.publish(DoorEvent.received(request));

    const carrier = keeping && door.carries && door.carrier ? door.carrier(received) : undefined;
    const namesByKeeper = byKeeper(carrier === undefined ? [] : keeping!.declared.filter((one) => one.keeper.over === door.carries));
    for (const [keeper, names] of namesByKeeper) {
      const tokens = await keeper.read(carrier, names, keeping!.storageFor);
      for (const { name } of names) {
        request.keepable.add(name);
        const token = tokens.get(name);
        const value = token === undefined ? undefined : await keeping!.seal.open(token);
        if (value !== undefined) request.arrived.set(name, value);
      }
    }

    const refused = (failure: unknown): Answer => {
      if (watched) lifecycle.publish(DoorEvent.failed(request, failure));

      return door.encode({ refused: door.trusted ? framedOf(failure) : publicOf(failure) }, received, carrier);
    };
    const edges = async (): Promise<Answer> => {
      try {
        const decoded = await door.decode(received);
        if (watched) lifecycle.publish(DoorEvent.decoded(request));
        const answer = await door.run(decoded);
        for (const [keeper, names] of namesByKeeper) {
          const written = await Promise.all(names.filter(({ name }) => request.written.has(name)).map(async ({ name, options }) => {
            const value = request.written.get(name);

            return { name, options, token: value === undefined ? undefined : await keeping!.seal.close(value) };
          }));
          if (written.length > 0) await keeper.write(carrier, written, keeping!.storageFor);
        }

        return door.encode({ answered: answer }, received, carrier);
      } catch (failure) {
        return refused(failure);
      }
    };

    const standing = door.address ? (middlewaresAt?.(door.address) ?? []).filter((one) => one.door === door.name) : [];
    const through = standing.reduceRight<() => Promise<Answer>>(
      (next, one) => async () => {
        try {
          return await one.around(received, next, refused) as Answer;
        } catch (failure) {
          return refused(failure);
        }
      },
      edges,
    );

    const answer = await through();
    if (watched) lifecycle.publish(DoorEvent.encoded(request));

    return answer;
  });
}

function byKeeper(declared: readonly DeclaredState[]): Map<StateKeeper, DeclaredState[]> {
  const byKeeper = new Map<StateKeeper, DeclaredState[]>();
  for (const one of declared) byKeeper.set(one.keeper, [...(byKeeper.get(one.keeper) ?? []), one]);

  return byKeeper;
}

function framedOf(failure: unknown): FougereError {
  return failure instanceof FougereError
    ? failure
    : new FougereError({ code: ErrorCode.INTERNAL_ERROR, message: (failure as Error)?.message ?? String(failure), cause: failure });
}

function publicOf(failure: unknown): FougereError {
  const framed = framedOf(failure);

  return framed.code === ErrorCode.INTERNAL_ERROR ? new FougereError(toPublicError(framed)) : framed;
}
