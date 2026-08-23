/** Preserve the named properties carried by a list result when its rows are replaced. */
export function preserveArrayProperties<T extends unknown[]>(source: unknown[], target: T): T {
  for (const key of Object.keys(source)) {
    if (!/^\d+$/.test(key)) {
      (target as unknown as Record<string, unknown>)[key] =
        (source as unknown as Record<string, unknown>)[key];
    }
  }
  return target;
}
