import { loadScript, reachableOps } from '@fougere/testing/load';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import ProjectScan from '../services/ProjectScan.js';
import { remotesOf } from '@fougere/core/node';

export interface LoadScenario {
  /** Where it was written, or `null` when it was only printed. */
  file: string | null;
  facade: string;
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

  /** Generate a k6 scenario covering every operation the default facade answers. */
  async execute(input: { root?: string; facade?: string; out?: string }): Promise<LoadScenario> {
    const { root, fronds, config } = await this.projectScan.at(input.root);
    const facade = input.facade?.trim() || undefined;
    // The topology statement travels with it: an op that crosses a process is not held to the
    // same figure as one that never leaves, and `remotes:` is what says which is which.
    const remotes = remotesOf(config);
    const script = loadScript({ fronds }, { ...(facade ? { facade } : {}), remotes });

    const file = input.out === undefined ? join(root, 'load.js') : input.out || null;
    if (file) await writeFile(file, script, 'utf8');

    return {
      file,
      facade: facade ?? 'http://127.0.0.1:3000/_fougere/call',
      operations: reachableOps({ fronds }, {}, remotes).map((one) => one.method),
      script,
    };
  }
}
