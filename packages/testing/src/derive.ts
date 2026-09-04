import { Cases, type ValidationCase } from '@fougere/schema';
import type { SchemaView } from '@fougere/schema';
import { sampleInput, type SampleOptions } from './sample.js';

/** The cases, with the valid body generated rather than handed in. */
export function derivedCases(
  entity: SchemaView,
  given: Record<string, unknown> = {},
  options: SampleOptions = {},
): readonly ValidationCase[] {
  return Cases.of(entity, sampleInput(entity, given, options)).all;
}
