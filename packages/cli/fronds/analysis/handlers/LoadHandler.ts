import { loadScript, reachableOps } from '@fougere/testing';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import ProjectScan from '../services/ProjectScan.js';

export interface LoadScenario {
  /** Where it was written, or `null` when it was only printed. */
  file: string | null;
  door: string;
  /** Every operation the scenario calls, in the order it lists them. */
  operations: string[];
  script: string;
}

/**
 * A load scenario, written from what the project serves.
 *
 * Read from the SCAN rather than a boot: an app that boots runs its migrations and plants its
 * seeds, and a command that describes a project has no business writing to its database.
 */
export default class LoadHandler {
  constructor(private projectScan: ProjectScan) {}

  /** Generate a k6 scenario covering every operation the default door answers. */
  async execute(input: { root?: string; door?: string; out?: string }): Promise<LoadScenario> {
    const { root, fronds } = await this.projectScan.at(input.root);
    const door = input.door?.trim() || undefined;
    const script = loadScript({ fronds }, { ...(door ? { door } : {}) });

    const file = input.out === undefined ? join(root, 'load.js') : input.out || null;
    if (file) await writeFile(file, script, 'utf8');

    return {
      file,
      door: door ?? 'http://127.0.0.1:3000/_fougere/call',
      operations: reachableOps({ fronds }).map((one) => one.method),
      script,
    };
  }
}
