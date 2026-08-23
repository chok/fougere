import { entity, nullable, optional, text } from '@fougere/schema';

export default class Presence extends entity({
  optionalOnly: optional(text()),
  requiredNullable: nullable(text()),
  optionalNullable: optional(nullable(text())),
}) {}
