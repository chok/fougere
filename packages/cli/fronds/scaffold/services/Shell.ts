import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { PackageManager } from '../../../src/scaffold/PackageManager.js';

/** Runs a host's own scaffolder — the one step of `fougere new` that reaches the network. */
export default class Shell {
  /**
   * Writes the host's shell at `parent/dir`. `{dir}` in the command stands for `dir`, `{pm}` for the
   * package manager the project is made with — the host's tool writes its own lockfile hints for it.
   */
  async create(command: readonly string[], parent: string, dir: string, manager: PackageManager = PackageManager.of()): Promise<void> {
    const args = command.map((part) => (part === '{dir}' ? dir : part.replaceAll('{pm}', manager.name)));
    const [bin, argv] = manager.exec(args);
    const child = spawn(bin, argv, { cwd: parent, stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, CI: '1' } });
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    const [code] = await once(child, 'close') as [number | null];
    if (code !== 0) throw new Error(`${command[0]} could not write the app's shell:\n${stderr.trim()}`);
  }
}
