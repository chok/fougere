import type { Shape } from "./shape.js";
import { validateField } from "./validate-field.js";
import type { Role } from "./role.js";
import type { Lifecycle } from "./lifecycle.js";
import type { BoundaryRef } from "./boundary.js";
import type { Meta } from "./meta.js";

export class Field<T = unknown> {
  readonly shape: Shape;
  readonly role?: Role;
  readonly lifecycle?: Lifecycle;
  readonly boundary?: BoundaryRef;
  readonly meta?: Meta;
  declare readonly _type?: T;

  constructor(init: FieldData, key?: string) {
    const verdict = validateField(init);

    if (!verdict.success) {
      throw new Error(
        `${key ? `Field '${key}': ` : ""}` +
          verdict.errors.map((e) => `${e.path}: ${e.message}`).join("; "),
      );
    }

    this.shape = init.shape;
    this.role = init.role;
    this.lifecycle = init.lifecycle;
    this.boundary = init.boundary;
    this.meta = init.meta;
  }

  with<U = T>(overrides: Partial<FieldData>): Field<U> {
    return new Field<U>({ ...this, ...overrides });
  }
}

/** A record of fields — the input to `entity()` and every derivation. */
export type Fields = Record<string, Field>;

export type FieldData = {
  [K in keyof Field as Field[K] extends (...args: never[]) => unknown
    ? never
    : K]: Field[K];
};
