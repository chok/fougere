/**
 * A Node builtin, read when an engine OPENS rather than when this module loads — so the adapter
 * loads on a runtime that has none, and only the engine that needs one refuses there.
 */
export function builtin<Module>(id: string, engine: string): Module {
  const found = (globalThis as { process?: { getBuiltinModule?: (id: string) => unknown } })
    .process?.getBuiltinModule?.(id);
  if (!found) {
    throw new Error(`The ${engine} database needs '${id}', which this runtime does not have.`);
  }

  return found as Module;
}
