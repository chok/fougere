// ─── Axis 2 · role — place in the entity graph ────────────
// Identity and relations. Read by the storage and transport adapters, and by the judge:
// `relation.kind === 'many'` makes an absent collection default to `[]`.
//
// `unique` and `index` are the only axis members realized OUTSIDE the framework — the DDL
// emits them and the database enforces them, so a collision surfaces as the driver's
// error, never as a `validate()` failure.
//
// ⚠️ A `unique` member list may be EMPTY, denoting the field that carries it — a field
// does not know its own key. Every reader goes through `uniqueMembers(group, key)`.
// `describe` resolves it on the way out, so a card always names its members; keeping it
// unresolved in memory is what makes `rename()` free.
//
// The in-repo readers do this (`schema-sql/src/table.ts`, `projections/describe.ts`). A
// consumer reading a CARD never meets the empty form: `describe` resolves it on the way
// out, so the wire always names its members — which is the point of resolving it there
// and not in `entity()`. Keeping it unresolved in memory is what makes `rename()` free:
// a self-reference names no key, so there is nothing to remap when the key moves.

export type EntityConstructor = abstract new (...args: any[]) => any;

/**
 * Normalize a relation target to a lazy thunk. A target may be given as the entity
 * class directly (`ref(Author)`) or as a thunk (`ref(() => Author)`) — the thunk
 * form is needed for circular/forward references, where the class isn't defined yet
 * when `entity({...})` is evaluated. An entity class is recognized by its static
 * `getFields`; anything else is treated as the thunk itself.
 */
export function toTargetThunk<E extends EntityConstructor>(target: E | (() => E)): () => E {
  return 'getFields' in target ? () => target as E : (target as () => E);
}

export interface Relation {
  to: () => EntityConstructor;
  kind: 'one' | 'many';
  onDelete?: 'cascade' | 'restrict' | 'set null';
}

export interface Role {
  primary?: boolean;
  /**
   * The constraints this field belongs to — one member list each. A lone `unique(slug)` is
   * the degenerate case, a set of one, so there is one shape and not two.
   *
   * **An empty list denotes the field carrying it** — it does not know its own key. A named
   * group comes from the entity's own declaration, where a fact about a pair belongs.
   * NEVER read a group directly: {@link uniqueMembers} is the accessor.
   */
  unique?: ReadonlyArray<ReadonlyArray<string>>;
  index?: boolean;
  relation?: Relation;
}

/**
 * The constraint a member list denotes, resolved against the field carrying it — the
 * accessor every reader of `role.unique` goes through.
 *
 * ```ts
 * uniqueMembers([], 'slug')                    // ['slug']            — the self-reference
 * uniqueMembers(['listId', 'docId'], 'docId')  // ['listId','docId']  — already named
 * ```
 *
 * `ownKey` is the half the field is missing: iterate `Object.entries(getFields())`.
 */
export function uniqueMembers(group: ReadonlyArray<string>, ownKey: string): string[] {
  return group.length === 0 ? [ownKey] : [...group];
}
