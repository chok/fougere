/**
 * Presenter(Entity) — enriches an entity's output with computed fields.
 *
 * Each method on the presenter is a computed field resolver:
 * - Receives the entity record as first argument
 * - Can be sync or async
 * - Injected via DI (constructor params resolved by the container)
 *
 * Usage:
 * ```ts
 * export default class PostPresenter extends Presenter(Post) {
 *   constructor(private commentOrm: CommentOrm) { super(); }
 *
 *   excerpt(post: Post) {
 *     return post.body.slice(0, 200);
 *   }
 *
 *   async commentCount(post: Post) {
 *     return this.commentOrm.countFor(post.id);
 *   }
 * }
 * ```
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EntityClass = abstract new (...args: any[]) => any;

const PRESENTER_TARGET = Symbol.for('fougere:presenter_target');

export function Presenter<E extends EntityClass>(entity: E) {
  class PresenterBase {
    static [PRESENTER_TARGET] = entity;
  }
  return PresenterBase;
}

/** Get the entity class a presenter targets. */
export function getPresenterTarget(ctor: Function): EntityClass | undefined {
  return (ctor as any)[PRESENTER_TARGET];
}

/** List computed field names from a presenter class (own methods minus constructor). */
export function getPresenterFields(ctor: Function): string[] {
  return Object.getOwnPropertyNames(ctor.prototype)
    .filter((name) => name !== 'constructor' && typeof ctor.prototype[name] === 'function');
}
