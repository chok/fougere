import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { emitDoors, emitScan } from '@fougere/compiler';
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
export const DOORS_OUT = 'doors.generated.d.ts';

export interface BuildReport {
  /** Absolute, so a caller can print it or read it back. */
  out: string;
  /** Relative to the project root — what a human recognizes. */
  path: string;
  /** Where the door types went, beside the module. */
  doors: string;
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
    // client cannot otherwise know is which refusals one door can answer, because TypeScript
    // records nothing about what a function throws.
    const doors = join(dirname(out), DOORS_OUT);
    await writeFile(doors, emitDoors(scan));

    return {
      out,
      path: relative(scan.root, out),
      doors: relative(scan.root, doors),
      fronds: scan.fronds.map((frond) => frond.name),
      entities: scan.fronds.reduce((total, frond) => total + frond.entities.length, 0),
      handlers: scan.fronds.reduce((total, frond) => total + frond.handlers.length, 0),
      diagnostics: scan.diagnostics.map((d) => `${d.severity} ${d.code}: ${d.message}`),
    };
  }
}
