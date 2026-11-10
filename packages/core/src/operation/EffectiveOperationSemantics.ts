/** The absence rules every facade normalises to before the handler is invoked. */
export const EFFECTIVE_OPERATION_SEMANTICS = Object.freeze({
  optional: 'undefined' as const,
  undefined: 'absence' as const,
  null: 'explicit-value' as const,
  jsonObjectUndefined: 'omitted' as const,
});
