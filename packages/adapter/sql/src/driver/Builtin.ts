/** A Node builtin, read when an engine opens rather than when this module loads. */
export function builtin<Module>(id: string, engine: string): Module {
  const found = (globalThis as { process?: { getBuiltinModule?: (id: string) => unknown } })
    .process?.getBuiltinModule?.(id);
  if (!found) {
    throw new Error(`The ${engine} database needs '${id}', which this runtime does not have.`);
  }

  return found as Module;
}
