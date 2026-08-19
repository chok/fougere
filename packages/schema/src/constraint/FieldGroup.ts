import type { Field, Fields } from '../Field.js';

/**
 * A named set of field keys carrying a fact about them TOGETHER. Everything here is set
 * logic — what the set MEANS belongs to the subclass, and {@link Unique} is the first.
 *
 * A group is carried by every field it names, so a reader holding one field knows the fact
 * without holding the entity. That is the whole reason it exists: a fact about a pair has no
 * single owner, and keeping it beside the fields made a second copy to hold in step.
 *
 * ```ts
 * const u = new Unique(['listId', 'docId'])
 * u.covers('docId')                                       // → true
 * u.rename(k => k === 'docId' ? 'bookId' : k)?.members    // → ['listId', 'bookId']
 * u.rename(k => k === 'docId' ? undefined : k)            // → null, a member is gone
 * ```
 */
export abstract class FieldGroup {
  constructor(readonly members: readonly string[]) {}

  /**
   * The same group over other members. Built from the runtime constructor, so a subclass
   * declares nothing: every one of them took `members` and returned `new Self(members)`,
   * which is this line spelled once per subclass.
   */
  protected withMembers(members: readonly string[]): this {
    return new (this.constructor as new (members: readonly string[]) => this)(members);
  }

  /**
   * True while the members are unnamed. `unique(text())` runs before `entity()` names the
   * field, so the group knows only that it is about its carrier.
   */
  get isSelf(): boolean {
    return this.members.length === 0;
  }

  /** The same group, its carrier named. Already-named members are returned untouched. */
  resolvedOn(ownKey: string): this {
    return this.isSelf ? this.withMembers([ownKey]) : this;
  }

  covers(key: string): boolean {
    return this.members.includes(key);
  }

  equals(other: FieldGroup): boolean {
    return (
      this.constructor === other.constructor &&
      this.members.length === other.members.length &&
      this.members.every((member, i) => member === other.members[i])
    );
  }

  /**
   * Attaches itself to every field it names, and refuses a member the map does not hold —
   * a group naming a field that does not exist states nothing and used to land in silence.
   *
   * ```ts
   * new Unique(['listId', 'docId']).onto(fields)
   * //   → listId.role.rules = [Unique('listId','docId')]
   * //     docId.role.rules  = [Unique('listId','docId')]
   * ```
   */
  onto(fields: Fields): Fields {
    const missing = this.members.filter((key) => !(key in fields));
    if (missing.length)
      throw new Error(
        `${this.constructor.name.toLowerCase()}: [${this.members.join(", ")}] names ` +
          `${missing.map((m) => `'${m}'`).join(", ")}, which the entity does not declare.`,
      );

    const out: Fields = { ...fields };
    for (const key of this.members) {
      const field = out[key]!;
      out[key] = field.with({
        role: { ...field.role, rules: [...(field.role?.rules ?? []), this] },
      });
    }
    return out;
  }

  /**
   * The same group under new key names, or null when a member is gone — a group that lost
   * one says nothing about the rest: `(listId, docId)` never implied `listId` alone.
   */
  rename(map: (key: string) => string | undefined): this | null {
    if (this.isSelf) return this; // names no key, so nothing to remap
    const carried = this.members.map(map);
    return carried.every((key): key is string => key !== undefined)
      ? this.withMembers(carried)
      : null;
  }

  /** The wire form — a card names members, so `describe` needs no accessor. */
  toJSON(): string[] {
    return [...this.members];
  }

  /**
   * Every self-reference on these fields replaced by the key that carries it. `entity()`
   * runs it once, so past its door a group always names its members and there is one shape.
   */
  static resolveSelf(fields: Fields): Fields {
    const out: Fields = {};
    for (const [key, field] of Object.entries(fields)) {
      const rules = field.role?.rules;
      out[key] = rules?.some((rule) => rule.isSelf)
        ? field.with({ role: { ...field.role, rules: rules.map((rule) => rule.resolvedOn(key)) } })
        : field;
    }
    return out;
  }

  /**
   * The canonical form of what a role declares. A plain member list — from a config, from
   * plain JS, from a card another language wrote — becomes the group it denotes; a group
   * already built is returned as is. The door normalizes so no reader has to.
   *
   * ```ts
   * FieldGroup.normalize([['slug']], Unique)       // → [Unique('slug')]
   * FieldGroup.normalize([new Unique([])], Unique)  // → unchanged
   * ```
   */
  static normalize<R extends FieldGroup>(
    groups: ReadonlyArray<R | ReadonlyArray<string>> | undefined,
    make: (members: readonly string[]) => R,
  ): ReadonlyArray<R> | undefined {
    if (!groups) return undefined;
    return groups.map((group) => (group instanceof FieldGroup ? (group as R) : make(group)));
  }

  /** The groups of one kind this field carries. */
  static on<R extends FieldGroup>(field: Field, kind: Function & { prototype: R }): R[] {
    return (field.role?.rules ?? []).filter((rule): rule is R => rule instanceof kind);
  }

  /**
   * The groups of one kind these fields state together — deduplicated, and only those of
   * more than one member: a group of one is fully stated by the field carrying it.
   *
   * ```ts
   * FieldGroup.groupsOf(ListBook.getFields(), Unique).map(r => r.members)
   * //   → [['listId', 'docId']]
   * ```
   */
  static groupsOf<R extends FieldGroup>(fields: Fields, kind: Function & { prototype: R }): R[] {
    const seen = new Map<string, R>();
    for (const field of Object.values(fields))
      for (const rule of FieldGroup.on(field, kind))
        if (rule.members.length > 1) seen.set(rule.members.join(" "), rule);
    return [...seen.values()];
  }
}
