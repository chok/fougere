/** How a source file becomes a module — one registry, two readers. */
import { pathToFileURL } from 'node:url';

/** Module loader — can be swapped (e.g. */
export type ModuleLoader = (
  filePath: string,
  options?: { fresh?: boolean },
) => Promise<Record<string, unknown>>;

const defaultLoader: ModuleLoader = async (filePath, options) => {
  // On the URL, never on the path: `pathToFileURL` percent-encodes a `?` into the
  // filename, and the import then looks for a file whose name ends in `%3Fv=…`.
  const url = pathToFileURL(filePath).href;
  return await import(options?.fresh ? `${url}?v=${Date.now()}` : url);
};

let activeLoader: ModuleLoader = defaultLoader;

/** Override the module loader used by the scanner (e.g. for jiti/tsx support). */
export function setModuleLoader(loader: ModuleLoader): void {
  activeLoader = loader;
}

/** Used by config-loader to load fougere.config.ts via the same TS-aware loader. */
export function getModuleLoader(): ModuleLoader {
  return activeLoader;
}
