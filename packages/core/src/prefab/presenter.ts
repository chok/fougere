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

import { upperFirst, type EntityConstructor } from '@fougere/schema';

/**
 * The view a computed field emits — `OrderItemView` for one, `[OrderItemView]` for many.
 * A view is a schema, so it derives: `Order.pick('id', 'status')`, never a hand-written type.
 */
export type PresenterViews = Record<string, EntityConstructor | [EntityConstructor]>;

/**
 * `Presenter(Order, { items: [OrderItemView], user: UserCard })` — the second argument names
 * the view each computed field emits, exactly as `Crud(Post, { list: PostCard })` names an
 * op's. What fabricates a field declares its contract, and it declares it **once**: the
 * façade applies the presenter (see `PresenterExecutor`), and every surface reads the same statement
 * instead of guessing.
 *
 * Guessing was the cost of not stating it. The scan can read a scalar off a return type and
 * nothing more, so a field returning an object had no derivable shape: the GraphQL projection
 * fell back to a serialized `String`, and a client asking `items { quantity }` got a schema
 * error on a field REST served whole. Declaring is optional — a scalar field needs nothing,
 * and an undeclared object keeps the old behaviour.
 */
export function Presenter<E extends EntityConstructor>(entity: E, views?: PresenterViews) {
  class PresenterBase {
    static readonly __entity = entity;
    static readonly __views = views;
  }
  return PresenterBase;
}

/** List computed field names from a presenter class (own methods minus constructor). */
export function getPresenterFields(ctor: Function): string[] {
  return Object.getOwnPropertyNames(ctor.prototype)
    .filter((name) => name !== 'constructor' && typeof ctor.prototype[name] === 'function');
}

/** Container key of an entity's presenter — 'post' → 'PostPresenter'. */
export function presenterKeyOf(entity: string): string {
  return `${upperFirst(entity)}Presenter`;
}
