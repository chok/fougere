export interface RouteAddressInput {
  entity: string;
  operation: string;
  surface?: string;
  frond?: string;
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
  readonly frond?: string;

  constructor(input: RouteAddressInput) {
    this.entity = required(input.entity, 'entity');
    this.operation = required(input.operation, 'operation');
    this.surface = optional(input.surface, 'surface');
    this.frond = optional(input.frond, 'frond');
    Object.freeze(this);
  }

  key(): string {
    return JSON.stringify([this.frond ?? null, this.surface ?? null, this.entity, this.operation]);
  }

  equals(other: RouteAddress): boolean {
    return this.key() === other.key();
  }

  toString(): string {
    const owner = this.frond ? `${this.frond}/` : '';
    const audience = this.surface ? `${this.surface}/` : '';
    return `${owner}${audience}${this.entity}.${this.operation}`;
  }

  toJSON(): RouteAddressInput {
    return {
      entity: this.entity,
      operation: this.operation,
      ...(this.surface !== undefined ? { surface: this.surface } : {}),
      ...(this.frond !== undefined ? { frond: this.frond } : {}),
    };
  }
}
