import { DoorEvent } from '../dispatch/DoorEvent.js';
import type { DispatchLifecycle } from '../dispatch/DispatchLifecycle.js';
import { DoorRequest } from '../wire/DoorRequest.js';
import { ErrorCode } from '../wire/ErrorCode.js';
import { FougereError } from '../wire/FougereError.js';
import { toPublicError } from '../wire/http-error.js';

/** What a door's calls answered, or the refusal it is to say instead — already fit for its caller. */
export type DoorOutcome = { answered: unknown } | { refused: FougereError };

/**
 * A way in, as the package that brings it writes it — its edges, in its own terms. Core names no
 * door: it runs the one cycle over whichever it is handed.
 *
 * Documented: [surfaces](https://fougere.dev/docs/infra/surfaces).
 */
export interface Door<Received, Decoded, Answer> {
  /** The package's word for it — `rest`, `graphql` — which core never reads but to say where. */
  readonly name: string;
  /**
   * Its caller is the operator — a terminal on the machine — so a refusal reaches it whole, an
   * accident's own message included, where every other door reads `Internal error`.
   */
  readonly trusted?: boolean;
  /**
   * The one address it answers for, when it answers for one — a REST route. Its frond's door
   * middlewares then stand around it; a door spanning several (a GraphQL document) has none.
   */
  readonly address?: string;
  /** What arrived, made into what the calls need — within `maxBodyBytes`, whatever the door. */
  decode(received: Received): Promise<Decoded>;
  /** The calls a request makes — one, or several for a document that asks for several things. */
  run(decoded: Decoded): Promise<unknown>;
  /** The outcome in the door's own shape — a status, an `errors` list, a frame — beside what arrived. */
  encode(outcome: DoorOutcome, received: Received): Answer;
}

/** Running one request through a door — `app.answer`, or `answerAt` for a host holding no app. */
export type Answering = <Received, Decoded, Answer>(door: Door<Received, Decoded, Answer>, received: Received) => Promise<Answer>;

/** A door middleware as the cycle runs it: the door it stands at, and its `around`. */
export interface DoorAround {
  door: string;
  around(received: unknown, next: () => Promise<unknown>): Promise<unknown>;
}

/** What the cycle needs of the app: where a request is entered, who watches it, who stands around it. */
export interface DoorCycle {
  enterRequest<R>(request: DoorRequest, fn: () => Promise<R>): Promise<R>;
  lifecycle: Pick<DispatchLifecycle, 'publish'>;
  /** The door middlewares the frond of an address declared, outermost first. */
  middlewaresAt?(address: string): readonly DoorAround[];
}

/** A cycle nobody watches — a host holding a runner and no app, or a boot that refused. */
const UNWATCHED: DoorCycle = { enterRequest: (_request, fn) => fn(), lifecycle: { publish: () => {} } };

/**
 * The one cycle every door runs: the request entered so each call it makes says which, its
 * steps announced beside the calls, and a refusal made public by one rule before the door says it.
 * `app.answer` runs it watched; a host with no app runs it as it is.
 */
export function answerAt<Received, Decoded, Answer>(
  door: Door<Received, Decoded, Answer>,
  received: Received,
  { enterRequest, lifecycle, middlewaresAt }: DoorCycle = UNWATCHED,
): Promise<Answer> {
  const request = DoorRequest.open(door.name);

  return enterRequest(request, async () => {
    lifecycle.publish(DoorEvent.received(request));

    const refused = (failure: unknown): Answer => {
      lifecycle.publish(DoorEvent.failed(request, failure));

      return door.encode({ refused: door.trusted ? framedOf(failure) : publicOf(failure) }, received);
    };
    const edges = async (): Promise<Answer> => {
      try {
        const decoded = await door.decode(received);
        lifecycle.publish(DoorEvent.decoded(request));

        return door.encode({ answered: await door.run(decoded) }, received);
      } catch (failure) {
        return refused(failure);
      }
    };

    // Outermost first: the first one stands around all the others. A refusal becomes the door's
    // answer where it is thrown, so a middleware standing outside it still sees an answer.
    const standing = door.address ? (middlewaresAt?.(door.address) ?? []).filter((one) => one.door === door.name) : [];
    const through = standing.reduceRight<() => Promise<Answer>>(
      (next, one) => async () => {
        try {
          return await one.around(received, next) as Answer;
        } catch (failure) {
          return refused(failure);
        }
      },
      edges,
    );

    const answer = await through();
    lifecycle.publish(DoorEvent.encoded(request));

    return answer;
  });
}

/** A failure in the vocabulary every door speaks — an accident framed as `INTERNAL_ERROR`. */
function framedOf(failure: unknown): FougereError {
  return failure instanceof FougereError
    ? failure
    : new FougereError({ code: ErrorCode.INTERNAL_ERROR, message: (failure as Error)?.message ?? String(failure), cause: failure });
}

/** A refusal as its caller may read it: its own words, or `Internal error` for an accident. */
function publicOf(failure: unknown): FougereError {
  const framed = framedOf(failure);

  return framed.code === ErrorCode.INTERNAL_ERROR ? new FougereError(toPublicError(framed)) : framed;
}
