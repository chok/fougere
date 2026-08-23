import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { emitScan } from '@fougere/core/node';
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

export interface BuildReport {
  /** Absolute, so a caller can print it or read it back. */
  out: string;
  /** Relative to the project root — what a human recognizes. */
  path: string;
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

  /** Write down what a scan found, so a deployment reads no disk. */
  async execute(input: Build): Promise<BuildReport> {
    const scan = await this.projectScan.at(input.root ?? undefined);
    const out = resolve(scan.root, input.out || DEFAULT_OUT);

    // The emitter writes every import relative to where the module will SIT, so the
    // directory has to be settled before the source is produced, not after.
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, emitScan(scan, { outFile: out }));

    return {
      out,
      path: relative(scan.root, out),
      fronds: scan.fronds.map((frond) => frond.name),
      entities: scan.fronds.reduce((total, frond) => total + frond.entities.length, 0),
      handlers: scan.fronds.reduce((total, frond) => total + frond.handlers.length, 0),
      diagnostics: scan.diagnostics.map((d) => `${d.severity} ${d.code}: ${d.message}`),
    };
  }
}
