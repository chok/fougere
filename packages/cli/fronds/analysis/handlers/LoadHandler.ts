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

async function keep(file: string, script: string, force = false): Promise<void> {
  await writeFile(file, script, { encoding: 'utf8', flag: force ? 'w' : 'wx' }).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'EEXIST') throw error;
    throw new Error(`${file} already exists, and it may hold your weights. Use --force to replace it, or --out to write elsewhere.`);
  });
}

export default class LoadHandler {
  constructor(private projectScan: ProjectScan) {}

  /** Generate a k6 scenario covering every operation the default facade answers. */
  async execute(input: { root?: string; facade?: string; out?: string; force?: boolean }): Promise<LoadScenario> {
    const { root, fronds, config } = await this.projectScan.at(input.root);
    const facade = input.facade?.trim() || undefined;
    const remotes = remotesOf(config);
    const script = loadScript({ fronds }, { ...(facade ? { facade } : {}), remotes });

    const file = input.out === undefined ? join(root, 'load.js') : input.out || null;
    if (file) await keep(file, script, input.force);

    return {
      file,
      facade: facade ?? 'http://127.0.0.1:3000/_fougere/call',
      operations: reachableOps({ fronds }, {}, remotes).map((one) => one.method),
      script,
    };
  }
}
