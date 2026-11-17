/**
 * Where a value carries behaviour — a function, or an object whose prototype holds methods — as a path, or undefined when it is data.
 * Ex: `behaviourIn({ name: 'fern', shout() {} })` is `['shout']`, `behaviourIn(new Map())` is `[]`.
 */
export function behaviourIn(value: unknown, path: readonly string[] = []): readonly string[] | undefined {
  if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') return path;
  if (value === null || typeof value !== 'object' || value instanceof Date) return undefined;
  if (methodsOf(Object.getPrototypeOf(value))) return path;

  for (const [key, held] of Object.entries(value)) {
    const found = behaviourIn(held, [...path, key]);
    if (found) return found;
  }

  return undefined;
}

function methodsOf(prototype: object | null): boolean {
  for (let level = prototype; level && level !== Object.prototype && level !== Array.prototype; level = Object.getPrototypeOf(level)) {
    const own = Object.getOwnPropertyNames(level).filter((name) => name !== 'constructor');
    if (own.some((name) => typeof Object.getOwnPropertyDescriptor(level!, name)?.value === 'function')) return true;
  }

  return false;
}
