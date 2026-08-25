import { Cases, type Case } from '@fougere/schema';
import type { SchemaView } from '@fougere/schema';
import { sampleInput, type SampleOptions } from './sample.js';

/**
 * The cases, with the valid body generated rather than handed in.
 *
 * `Cases` lives in `@fougere/schema` because deriving them reads the four axes and
 * nothing else. This is the half that needs a generator, which is why it is here: a
 * 426 KB faker has no business in the package a browser loads.
 */
export function derivedCases(
  entity: SchemaView,
  given: Record<string, unknown> = {},
  options: SampleOptions = {},
): readonly Case[] {
  return Cases.of(entity, sampleInput(entity, given, options)).all;
}
