import { bool, entity, text } from '@fougere/schema';

/** What the handler observed, expressed without relying on a protocol's null encoding. */
export default class Absence extends entity({
  optionalOnly: text(),
  requiredNullable: text(),
  optionalNullable: text(),
  ownsOptionalNullable: bool(),
}) {}
