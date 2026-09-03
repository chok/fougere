import type { Field, Fields } from '../Field.js';

export abstract class FieldGroup {
  /**
   * So a rule over several fields is one value, instead of the same list copied onto each.
   * FR : pour qu'une règle sur plusieurs champs soit une valeur, pas une liste recopiée.
   * `new Unique(['email', 'tenant'])`
   */
  constructor(readonly members: readonly string[]) {}

  /**
   * So a subclass rebuilds as itself, and a `Unique` never comes back a bare `FieldGroup`.
   * FR : pour qu'une sous-classe se reconstruise en elle-même.
   * `new Unique(['email']).withMembers(['mail'])` → a `Unique`
   */
  protected withMembers(members: readonly string[]): this {
    return new (this.constructor as new (members: readonly string[]) => this)(members);
  }

  /**
   * So `unique()` written on a field can wait for the key it will sit under.
   * FR : pour qu'un `unique()` écrit sur un champ attende la clé qui le porte.
   * `new Unique([]).isSelf` → `true`
   */
  get isSelf(): boolean {
    return this.members.length === 0;
  }

  /**
   * So `unique()` on a field and `unique: [['email']]` on the entity become one same value.
   * FR : pour qu'un `unique()` sur un champ et un `unique: [['email']]` soient un.
   * `new Unique([]).resolvedOn('email')` → `Unique(['email'])`
   */
  resolvedOn(ownKey: string): this {
    return this.isSelf ? this.withMembers([ownKey]) : this;
  }

  /**
   * So a reader can ask a group about one field without reading its member list.
   * FR : pour qu'on interroge un groupe sur un champ sans lire ses membres.
   * `new Unique(['email', 'tenant']).covers('tenant')` → `true`
   */
  covers(key: string): boolean {
    return this.members.includes(key);
  }

  /**
   * So a rename that changed nothing returns the field untouched instead of a new one.
   * FR : pour qu'un renommage sans effet rende le champ tel quel.
   * `Unique(['a', 'b']).equals(Unique(['b', 'a']))` → `false` — the order is part of the group
   */
  equals(other: FieldGroup): boolean {
    return (
      this.constructor === other.constructor &&
      this.members.length === other.members.length &&
      this.members.every((member, i) => member === other.members[i])
    );
  }

  /**
   * So a group naming a field the entity never declared is caught here, not at the DDL.
   * FR : pour qu'un groupe nommant un champ inexistant soit attrapé ici, pas au DDL.
   * `new Unique(['email', 'ghost']).onto({ email })`
   * → throws `unique: [email, ghost] names 'ghost', which the entity does not declare.`
   */
  onto(fields: Fields): Fields {
    const missing = this.members.filter((key) => !(key in fields));
    if (missing.length)
      throw new Error(
        `${this.constructor.name.toLowerCase()}: [${this.members.join(', ')}] names ` +
          `${missing.map((m) => `'${m}'`).join(', ')}, which the entity does not declare.`,
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
   * So a group loses all its force the moment one member is gone, rather than half of it.
   * FR : pour qu'un groupe perde toute force dès qu'un membre disparaît.
   * `Unique(['email', 'tenant'])` with `tenant` cut → `null`
   */
  rename(map: (key: string) => string | undefined): this | null {
    if (this.isSelf) return this;
    const renamed = this.members.map(map);
    return renamed.every((key): key is string => key !== undefined)
      ? this.withMembers(renamed)
      : null;
  }

  /**
   * So a card carries the group as data, with nothing of this class in it.
   * FR : pour qu'une carte porte le groupe en donnée, sans rien de cette classe.
   * `new Unique(['email', 'tenant']).toJSON()` → `['email', 'tenant']`
   */
  toJSON(): string[] {
    return [...this.members];
  }

  /**
   * So a declaration may write bare member lists and a card may carry built groups.
   * FR : pour qu'une déclaration écrive des listes et une carte des groupes.
   * `normalize([['email', 'tenant']], make)` → `[Unique(['email', 'tenant'])]`
   */
  static normalize<R extends FieldGroup>(
    groups: readonly (R | readonly string[])[] | undefined,
    make: (members: readonly string[]) => R,
  ): readonly R[] | undefined {
    if (!groups) return undefined;
    return groups.map((group) =>
      group instanceof FieldGroup ? (group as R) : make(group),
    );
  }

  /**
   * So a reader asks for the kind of group it handles, and ignores every other kind.
   * FR : pour qu'un lecteur demande le type de groupe qu'il traite.
   * `FieldGroup.on(email, Unique)` → the unique groups `email` belongs to
   */
  static on<R extends FieldGroup>(field: Field, kind: Function & { prototype: R }): R[] {
    return (field.role?.rules ?? []).filter((rule): rule is R => rule instanceof kind);
  }

  /**
   * So a group carried by three fields is emitted once, not three times, by whoever reads it.
   * FR : pour qu'un groupe porté par trois champs soit émis une fois.
   * `email` and `tenant` carrying one group → one entry
   */
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
