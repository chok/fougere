import { roleAxis } from './roleAxis.js';
import { lifecycleAxis } from './lifecycleAxis.js';
import { boundaryAxis } from './boundaryAxis.js';
import type { ValidationError } from '../judge/result.js';

/**
 * An axis that JSON Schema cannot express, and therefore rides in a card's `x-fougere`.
 * There are three: `role`, `lifecycle`, `boundary`. `shape` is not one of them — it IS the
 * card's body — and `meta` is an annotation JSON Schema already has a word for.
 *
 * The axis carries its own three projections. Before this, a fifth axis meant editing five
 * files: the slot on `Field`, the key on `FieldExtension`, and one clause in each of
 * `Judge.field`, `describeExtension`, `reconstructField`. Now it means one file and one
 * entry in {@link EXTENSION_AXES} — which is what *source unique → projections* says when
 * it is applied to the source's own structure and not only to its data.
 */
export interface Axis<Declared = unknown, Wire = unknown> {
  /** The key it occupies on a `Role`-style slot of `Field`, and on `FieldExtension`. */
  readonly slot: 'role' | 'lifecycle' | 'boundary';

  /** Judge the DECLARED form. By form, never by a brand — a card may come from anywhere. */
  judge(value: unknown, errors: ValidationError[]): void;

  /** Declaration → card. `undefined` means "this axis states nothing worth carrying". */
  describe(value: Declared, key: string): Wire | undefined;

  /** Card → declaration. `resolve` wires relation targets when the card is in a bundle. */
  reconstruct(wire: Wire, resolve?: Resolver): Declared;
}

/** Resolve a relation's `to` name to a live target — a bundle supplies one, a lone card none. */
export type Resolver = (name: string) => (abstract new (...args: never[]) => unknown) | undefined;


/**
 * The three axes a card carries under `x-fougere`, in wire order. THE list — the judge, the
 * describer and the reconstructor all fold it, so a fourth extension axis is one file and
 * one entry here.
 *
 * `shape` is absent on purpose: it is the card's body, not an extension. So is `meta`, whose
 * only member maps to JSON Schema's own `description`.
 */
export const EXTENSION_AXES: readonly Axis<never, never>[] = [
  roleAxis,
  lifecycleAxis,
  boundaryAxis,
] as unknown as readonly Axis<never, never>[];
