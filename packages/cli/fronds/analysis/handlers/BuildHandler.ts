import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { compileProject, emitAppOptions } from '@fougere/compiler';
import { BUILD_DIRECTORY, emitFacade, emitNames } from '@fougere/core/node';
import ProjectScan from '../services/ProjectScan.js';
import type Build from '../entities/Build.js';

/** Where the module lands when nobody says otherwise. */
export const DEFAULT_OUT = '.fougere/fronds.generated.ts';
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
  /** Where the project went as JavaScript — what `fougere serve` starts — and how many files it holds. */
  built: string;
  files: number;
  fronds: string[];
  entities: number;
  handlers: number;
  /** What the scan could not settle — said here, at build, since the statement states fronds and nothing else. */
  diagnostics: string[];
}

/** Writing the scan down as the statement an author would write — what a runtime without a disk boots. */
export default class BuildHandler {
  constructor(private projectScan: ProjectScan) {}

  /** Write down what a scan found, so a deployment reads no disk. */
  async execute(input: Omit<Build, 'json'>): Promise<BuildReport> {
    const scan = await this.projectScan.at(input.root ?? undefined);
    const out = resolve(scan.root, input.out || DEFAULT_OUT);

    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, emitAppOptions(scan, { outFile: out }));

    const facade = join(dirname(out), FACADE_OUT);
    await writeFile(facade, emitFacade(scan, { outFile: facade }));

    const names = join(dirname(out), NAMES_OUT);
    await writeFile(names, emitNames(scan));

    const built = await compileProject(scan.root, scan, resolve(scan.root, BUILD_DIRECTORY));

    return {
      out,
      path: relative(scan.root, out),
      facade: relative(scan.root, facade),
      names: relative(scan.root, names),
      built: relative(scan.root, built.out),
      files: built.files.length,
      fronds: scan.fronds.map((frond) => frond.name),
      entities: scan.fronds.reduce((total, frond) => total + frond.entities.length, 0),
      handlers: scan.fronds.reduce((total, frond) => total + frond.handlers.length, 0),
      diagnostics: scan.diagnostics.map((d) => `${d.severity} ${d.code}: ${d.message}`),
    };
  }
}
