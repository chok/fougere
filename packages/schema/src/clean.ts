/**
 * Drop the keys whose value is `undefined`, in place. Nothing here knows about a schema —
 * it serves any serializer, which is why it does not live inside one.
 *
 * ```ts
 * clean({ a: 1, b: undefined })   // → { a: 1 }
 * ```
 */
export function clean<T extends Record<string, unknown>>(obj: T): T {
  for (const key of Object.keys(obj)) if (obj[key] === undefined) delete obj[key];
  return obj;
}
