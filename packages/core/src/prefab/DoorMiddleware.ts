/**
 * What runs around a door's requests for its frond — a class in `middlewares/` extending the base its
 * door's package hands out (`RestMiddleware()`), in the door's own terms: what arrived, and the answer
 * it gives. Core reads only which door it stands at, the word the package registered.
 *
 * Throwing before `next()` refuses the request, which the door then says in its own shape — before
 * the body is read, since the door reads it inside `next()`.
 */
export abstract class DoorMiddleware<Received = unknown, Answer = unknown> {
  /** The door it stands at — set by the package's base, never by the frond. */
  static readonly door: string = '';

  /**
   * The handler whose operations it stands around, one method per op it names — none means every
   * address of its frond.
   */
  static readonly handler?: abstract new (...args: never[]) => unknown;

  abstract around(received: Received, next: () => Promise<Answer>): Promise<Answer>;
}
