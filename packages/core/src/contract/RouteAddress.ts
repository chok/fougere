/** Which kind of destination served a call — it travels in a `CallRecord`. */
export type RouteKind = 'local' | 'remote' | 'system';

export interface RouteAddressInput {
  entity: string;
  operation: string;
  surface?: string;
}

/**
 * Refuses an empty segment, so no address can be built that nothing can serve.
 * FR : refuse un segment vide, pour qu'aucune adresse inservable ne soit construite.
 * `required('', 'entity')` → throws `Route entity cannot be empty`
 */
function required(value: string, name: string): string {
  if (value.trim().length === 0) throw new TypeError(`Route ${name} cannot be empty`);
  return value;
}

/**
 * Applies the same refusal to a segment that may be absent, but not blank.
 * FR : applique le même refus à un segment qui peut être absent, mais pas vide.
 * `optional(undefined, 'surface')` → `undefined`; `optional(' ', 'surface')` → throws
 */
function optional(value: string | undefined, name: string): string | undefined {
  return value === undefined ? undefined : required(value, name);
}

/** Canonical identity of one callable operation. */
export class RouteAddress {
  readonly entity: string;
  readonly operation: string;
  readonly surface?: string;

  /**
   * Names one callable operation, and freezes it so a registry key cannot drift.
   * FR : nomme une opération appelable, et la fige pour qu'une clé de registre ne dérive pas.
   * `new RouteAddress({ entity: 'post', operation: 'publish', surface: 'public' })`
   */
  constructor(input: RouteAddressInput) {
    this.entity = required(input.entity, 'entity');
    this.operation = required(input.operation, 'operation');
    this.surface = optional(input.surface, 'surface');
    Object.freeze(this);
  }

  /**
   * Serializes the three segments so a route can be looked up in a `Map`.
   * FR : sérialise les trois segments pour qu'une route se retrouve dans une `Map`.
   * `{ entity: 'post', operation: 'list' }` → `'[null,"post","list"]'`
   */
  key(): string {
    return JSON.stringify([this.surface ?? null, this.entity, this.operation]);
  }

  /**
   * Compares two addresses by their key, so `surface` counts as much as the operation.
   * FR : compare deux adresses par leur clé, `surface` comptant autant que l'opération.
   * `public/post.list` against `post.list` → `false`
   */
  equals(other: RouteAddress): boolean {
    return this.key() === other.key();
  }

  /**
   * Writes the address the way a log and an error message name it.
   * FR : écrit l'adresse comme un log et un message d'erreur la nomment.
   * `new RouteAddress({ entity: 'post', operation: 'list', surface: 'public' })`
   * → `'public/post.list'`
   */
  toString(): string {
    const audience = this.surface ? `${this.surface}/` : '';
    return `${audience}${this.entity}.${this.operation}`;
  }

  /**
   * Sends the address over the wire without `surface: undefined` riding along.
   * FR : envoie l'adresse sur le fil sans traîner un `surface: undefined`.
   * `{ entity: 'post', operation: 'list' }`
   */
  toJSON(): RouteAddressInput {
    return {
      entity: this.entity,
      operation: this.operation,
      ...(this.surface !== undefined ? { surface: this.surface } : {}),
    };
  }
}
