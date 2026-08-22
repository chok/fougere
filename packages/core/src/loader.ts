/**
 * How a source file becomes a module — one registry, two readers.
 *
 * The scanner loads fronds and `config-loader` loads a config, and both must use the
 * loader the host installed: a TS file needs jiti under Nuxt and plain `import` under
 * tsx. It lived in `scan/scanner.ts`, so reading a config dragged the scanner, its AST
 * parser and the TypeScript compiler behind it.
 */
import { pathToFileURL } from 'node:url';

/**
 * Module loader — can be swapped (e.g. jiti for TS files in Nuxt context).
 *
 * `fresh` asks for a file that may have changed since it was last read. Every loader
 * caches, so without it a second read of an EDITED file hands back the first one —
 * which is what re-reading a config is for. A loader that cannot honour it may ignore
 * the flag; it then answers with what it already had.
 */
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
