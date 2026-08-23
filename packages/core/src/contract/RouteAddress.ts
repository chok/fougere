export interface RouteAddressInput {
  entity: string;
  operation: string;
  surface?: string;
}

function required(value: string, name: string): string {
  if (value.trim().length === 0) throw new TypeError(`Route ${name} cannot be empty`);
  return value;
}

function optional(value: string | undefined, name: string): string | undefined {
  return value === undefined ? undefined : required(value, name);
}

/** Canonical identity of one callable operation. */
export class RouteAddress {
  readonly entity: string;
  readonly operation: string;
  readonly surface?: string;

  constructor(input: RouteAddressInput) {
    this.entity = required(input.entity, 'entity');
    this.operation = required(input.operation, 'operation');
    this.surface = optional(input.surface, 'surface');
    Object.freeze(this);
  }

  key(): string {
    return JSON.stringify([this.surface ?? null, this.entity, this.operation]);
  }

  equals(other: RouteAddress): boolean {
    return this.key() === other.key();
  }

  toString(): string {
    const audience = this.surface ? `${this.surface}/` : '';
    return `${audience}${this.entity}.${this.operation}`;
  }

  toJSON(): RouteAddressInput {
    return {
      entity: this.entity,
      operation: this.operation,
      ...(this.surface !== undefined ? { surface: this.surface } : {}),
    };
  }
}
