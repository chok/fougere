import type { Field, Fields } from '../Field.js';

export abstract class FieldGroup {
  constructor(readonly members: readonly string[]) {}

  protected withMembers(members: readonly string[]): this {
    return new (this.constructor as new (members: readonly string[]) => this)(members);
  }

  /** A group written on a field, still waiting for the key it will sit under. */
  get isSelf(): boolean {
    return this.members.length === 0;
  }

  /** `new Unique([]).resolvedOn('email')` → `Unique(['email'])` */
  resolvedOn(ownKey: string): this {
    return this.isSelf ? this.withMembers([ownKey]) : this;
  }

  covers(key: string): boolean {
    return this.members.includes(key);
  }

  /** The order is part of the group: `Unique(['a','b']).equals(Unique(['b','a']))` → `false`. */
  equals(other: FieldGroup): boolean {
    return (
      this.constructor === other.constructor &&
      this.members.length === other.members.length &&
      this.members.every((member, i) => member === other.members[i])
    );
  }

  /** `unique: [email, ghost] names 'ghost', which the entity does not declare.` */
  onto(fields: Fields): Fields {
    const missing = this.members.filter((key) => !(key in fields));
    if (missing.length)
      throw new Error(
        `${this.constructor.name.toLowerCase()}: [${this.members.join(', ')}] names ` +
          `${missing.map((m) => `'${m}'`).join(', ')}, which the entity does not declare.`,
      );

    const carrying: Fields = { ...fields };
    for (const key of this.members) {
      const field = carrying[key]!;
      carrying[key] = field.with({
        role: { ...field.role, rules: [...(field.role?.rules ?? []), this] },
      });
    }
    return carrying;
  }

  /** One member gone and the group is gone: `Unique(['email','tenant'])` minus `tenant` → `null`. */
  rename(map: (key: string) => string | undefined): this | null {
    if (this.isSelf) return this;
    const renamed = this.members.map(map);
    return renamed.every((key): key is string => key !== undefined)
      ? this.withMembers(renamed)
      : null;
  }

  toJSON(): string[] {
    return [...this.members];
  }

  /** Takes bare member lists as well as built groups — a declaration writes the first. */
  static normalize<R extends FieldGroup>(
    groups: readonly (R | readonly string[])[] | undefined,
    make: (members: readonly string[]) => R,
  ): readonly R[] | undefined {
    if (!groups) return undefined;
    return groups.map((group) =>
      group instanceof FieldGroup ? (group as R) : make(group),
    );
  }

  static on<R extends FieldGroup>(field: Field, kind: Function & { prototype: R }): R[] {
    return (field.role?.rules ?? []).filter((rule): rule is R => rule instanceof kind);
  }

  /** Deduplicated: one group carried by three fields comes back once. */
  static groupsOf<R extends FieldGroup>(
    fields: Fields,
    kind: Function & { prototype: R },
  ): R[] {
    const seen = new Map<string, R>();
    for (const field of Object.values(fields))
      for (const rule of FieldGroup.on(field, kind))
        if (rule.members.length > 1) seen.set(rule.members.join(' '), rule);
    return [...seen.values()];
  }
}
