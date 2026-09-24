/**
 * Where the middlewares write. On `globalThis` for the reason the emit fixture is: jiti
 * loads these files, so a module-level array here is not the one the test imports.
 */
export default class Trail {
  note(line: string): void {
    ((globalThis as Record<string, unknown>).__around as string[]).push(line);
  }
}
