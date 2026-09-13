import { mkdir, writeFile } from 'node:fs/promises';
import { loadConfig } from '@fougere/core/node';
import { dirname, join, relative, resolve } from 'node:path';
import { emitFacade, emitNames, emitScan } from '@fougere/compiler';
import ProjectScan from '../services/ProjectScan.js';
import type Build from '../entities/Build.js';

/**
 * Where the module lands when nobody says otherwise.
 *
 * `.fougere/` because the artefact is REGENERABLE — which is exactly the test `freeze`
 * failed: a recorded version is a past nobody can recompute, so it lives in the tree.
 * This is the same scan the next build performs again, so it is gitignored.
 */
export const DEFAULT_OUT = '.fougere/scan.generated.ts';
/** Types only, beside the module — what lets a client narrow a refusal it might meet. */
export const FACADE_OUT = 'facade.generated.ts';
/** Types only — what a config may NAME, so a string cannot designate a class that is not there. */
export const NAMES_OUT = 'names.generated.d.ts';

export interface BuildReport {
  /** Absolute, so a caller can print it or read it back. */
  out: string;
  /** Relative to the project root — what a human recognizes. */
  path: string;
  /** Where the facades were written — one export per address, the page's facade in. */
  facade: string;
  /** Where the names went — the unions a config is judged against. */
  names: string;
  fronds: string[];
  entities: number;
  handlers: number;
  /**
   * What the scan could not settle, carried rather than swallowed: the module holds the
   * same diagnostics, so a boot from it warns exactly as a boot from a disk would.
   */
  diagnostics: string[];
}

/**
 * Writing the scan down — the half of the gradient a runtime without a disk needs.
 *
 * Producing the description reads the project; consuming it does not. `createApp` takes
 * `scan:` and never looks for a filesystem, so this command is what stands between a
 * project and a Worker: it runs where `node:fs` exists, once, at build time.
 */
export default class BuildHandler {
  constructor(private projectScan: ProjectScan) {}

  /**
   * Write down what a scan found, so a deployment reads no disk.
   *
   * `json` is the presentation's, so it is not part of what this operation receives.
   */
  async execute(input: Omit<Build, 'json'>): Promise<BuildReport> {
    const scan = await this.projectScan.at(input.root ?? undefined);
    const out = resolve(scan.root, input.out || DEFAULT_OUT);

    // The emitter writes every import relative to where the module will SIT, so the
    // directory has to be settled before the source is produced, not after.
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, emitScan(scan, { outFile: out }));

    // The same scan, projected a third way. It holds no value and reaches no bundle: what a
    // client cannot otherwise know is which refusals one facade can answer, because TypeScript
    // records nothing about what a function throws.
    const facade = join(dirname(out), FACADE_OUT);
    await writeFile(facade, emitFacade(scan, { outFile: facade }));

    // And a fourth, for the only place a name is still written as a string: a config file. The
    // sources are the config's own keys, which no scan can find.
    const config = await loadConfig(scan.root).catch(() => ({}) as Awaited<ReturnType<typeof loadConfig>>);
    const names = join(dirname(out), NAMES_OUT);
    await writeFile(names, emitNames(scan, { sources: Object.keys(config.sources ?? {}) }));

    return {
      out,
      path: relative(scan.root, out),
      facade: relative(scan.root, facade),
      names: relative(scan.root, names),
      fronds: scan.fronds.map((frond) => frond.name),
      entities: scan.fronds.reduce((total, frond) => total + frond.entities.length, 0),
      handlers: scan.fronds.reduce((total, frond) => total + frond.handlers.length, 0),
      diagnostics: scan.diagnostics.map((d) => `${d.severity} ${d.code}: ${d.message}`),
    };
  }
}
