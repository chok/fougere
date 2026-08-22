import { type ScanResult } from '@fougere/core';
import { scanProject, frondAliases, setModuleLoader } from '@fougere/core/node';
import { resolve } from 'node:path';

/**
 * Read a target project without booting it — what every analysis command needs first.
 *
 * `graph` and `check` had the same five lines each: resolve the root against the
 * CLI's cwd, install a jiti loader so the scan can import TypeScript sources, scan.
 * Two copies of one gesture, and the second was written by copying the first.
 *
 * Not a boot: `bootAppFromConfig` runs migrations and seeds, so an analysis command
 * that booted would write to the target's database. The cost is stated rather than
 * hidden, though — the scan IMPORTS the modules it reads, so a frond's top-level
 * code runs. "No application cycle, no database", not "no side effect".
 */
export default class ProjectScan {
  // cwd is ambient in a CLI — not a DI service (the container resolves by type).
  private cwd = process.cwd();

  /** Scan the project at `root`, relative to where the command was invoked. */
  async at(root?: string): Promise<ScanResult & { root: string }> {
    const target = resolve(this.cwd, root || '.');

    // The scan reads `.ts` sources; the default loader is a plain `import`, which
    // cannot. Installed once per call because the loader is module-global — the
    // CLI's own app was loaded with its own, and this replaces it for the target.
    const { createJiti } = await import('jiti');
    // `@frond/<name>` is the framework's own convention; the loader has to know it,
    // or a frond naming its neighbour is unreadable to the very tool that checks it.
    const jiti = createJiti(import.meta.url, { interopDefault: true, alias: await frondAliases(target) });
    setModuleLoader((filePath) => jiti.import(filePath) as Promise<Record<string, unknown>>);

    return { root: target, ...(await scanProject(target)) };
  }
}
