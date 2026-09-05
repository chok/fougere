/**
 * Every way a row is refused for its STRUCTURE — the closed set, stated once.
 *
 * A value refused by its own shape carries the engine's message and a decoder refused by
 * user code carries that code's; neither is structural and neither belongs here. These
 * five are `InputValidator`'s own, and a table of cases enumerates them instead of reading the
 * text of a function — which a minifier rewrites without a word.
 */
export const InputRefusal = {
  notAnObject: 'Expected an object',
  unknownField: 'Unknown field',
  required: 'Required',
  readOnly: 'Read-only',
  immutable: 'Immutable',
} as const;
