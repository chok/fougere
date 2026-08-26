import type { Field, Fields } from "../Field.js";

export abstract class FieldGroup {
  constructor(readonly members: readonly string[]) {}

  protected withMembers(members: readonly string[]): this {
    return new (this.constructor as new (members: readonly string[]) => this)(
      members,
    );
  }

  get isSelf(): boolean {
    return this.members.length === 0;
  }

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

  rename(map: (key: string) => string | undefined): this | null {
    if (this.isSelf) return this;
    const carried = this.members.map(map);
    return carried.every((key): key is string => key !== undefined)
      ? this.withMembers(carried)
      : null;
  }

  toJSON(): string[] {
    return [...this.members];
  }

  static normalize<R extends FieldGroup>(
    groups: readonly (R | readonly string[])[] | undefined,
    make: (members: readonly string[]) => R,
  ): readonly R[] | undefined {
    if (!groups) return undefined;
    return groups.map((group) =>
      group instanceof FieldGroup ? (group as R) : make(group),
    );
  }

  static on<R extends FieldGroup>(
    field: Field,
    kind: Function & { prototype: R },
  ): R[] {
    return (field.role?.rules ?? []).filter(
      (rule): rule is R => rule instanceof kind,
    );
  }

  static groupsOf<R extends FieldGroup>(
    fields: Fields,
    kind: Function & { prototype: R },
  ): R[] {
    const seen = new Map<string, R>();
    for (const field of Object.values(fields))
      for (const rule of FieldGroup.on(field, kind))
        if (rule.members.length > 1) seen.set(rule.members.join(" "), rule);
    return [...seen.values()];
  }
}
