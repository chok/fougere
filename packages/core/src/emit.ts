/**
 * Announcing a fact — the half of the topology `remotes:` never covered.
 *
 * Every other call in Fougere names **one** recipient: `remotes` names one address per
 * frond, `Facade<T>` resolves one door. `Emit<T>` names a **subject** instead, and the
 * number of readers is not the emitter's business.
 *
 * ```ts
 * constructor(private published: Emit<PostPublished>) {}
 * await this.published({ id, title });          // I say it happened. I do not know who cares.
 *
 * async reindex(fact: Fact<PostPublished>) {}   // any handler, any frond. Nothing to register.
 * ```
 *
 * **It is a resolver, not a channel.** A bus moves messages — it has a queue, an envelope
 * format, a delivery semantic. This has none of that: it answers *who*, then hands over to
 * the call path that already exists. It is `resolve` returning N things instead of one.
 * That is also why temporal decoupling stays out of reach: a resolver holds nothing. The
 * day at-least-once is wanted, a real channel goes UNDER this, in the transport — the
 * dispatch line becomes a publish and a consumer calls the same door on the far side.
 */
import { lowerFirst } from '@fougere/schema';

/**
 * What an emitter injects. Resolved by type, like `Storage<Post>` and `Facade<T>`.
 *
 * The returned promise settles when the fact has been **dispatched**, never when it has
 * been handled: a subscriber's failure is its own. The `EventBus` this replaces did
 * `await Promise.all(handlers)` and handed their rejections back, which made a publication
 * hostage to its own indexer.
 */
export type Emit<T> = (fact: T) => Promise<void>;

/**
 * What a subscriber accepts — and what it PROMISES about itself.
 *
 * Not merely "I subscribe". Push is the strict mode and pull is a special case of it: an
 * op written for push is correct when called directly, the reverse is false. So this
 * wrapper commits the operation to three things its author must honour, because no type
 * can check them:
 *
 * 1. **replayable** — delivery is at-least-once the day a broker sits underneath;
 * 2. **no reader for its return** — nobody receives what it hands back;
 * 3. **owner of its failures** — they reach a log, never the emitter.
 *
 * It is the identity at runtime. The scan reads the written name, which is the whole
 * mechanism: `binding.ts` sees `Fact<X>` and binds the parameter as a fact instead of
 * letting it fall through to "everything else — body".
 */
export type Fact<T> = T;

/**
 * The container key of an emission — THE one place that spells the format.
 *
 * Its dual is right below, because the boot reads the fact back out of a handler's `deps`
 * to know which emissions to register. A key and the way to undo it belong together: the
 * pair that is split is the pair that drifts.
 */
export function emitKeyOf(fact: string): string {
  return `${lowerFirst(fact)}Emit`;
}

const SUFFIX = 'Emit';

/** The fact behind an emission key, or `undefined` when the key is not one. */
export function factOfEmitKey(key: string): string | undefined {
  return key.length > SUFFIX.length && key.endsWith(SUFFIX)
    ? key.slice(0, -SUFFIX.length)
    : undefined;
}

/**
 * What a set of handlers ANNOUNCES — `Emit<T>` read back out of their dependencies.
 *
 * Two readers, which is exactly why it is a function and not a line: the boot registers one
 * emission value per name, and the identity card publishes the same set. Spelled twice they
 * would drift the day an emission stops being a constructor dependency.
 *
 * The dual — what a handler ACCEPTS — is not here, because it is not read the same way: a
 * `Fact<T>` parameter is a fact about one operation, and `computeBindingPlan` has already
 * written it into the plan (`app.listensTo()`).
 */
export function factsAnnouncedBy(handlers: readonly { deps: readonly string[] }[]): string[] {
  return [...new Set(
    handlers
      .flatMap((handler) => handler.deps)
      .map(factOfEmitKey)
      .filter((fact): fact is string => fact !== undefined),
  )];
}
