import { spawn } from 'node:child_process';
import { once } from 'node:events';

/** Runs a host's own scaffolder — the one step of `fougere new` that reaches the network. */
export default class Shell {
  /** Writes the host's shell at `parent/dir`. `{dir}` in the command stands for `dir`. */
  async create(command: readonly string[], parent: string, dir: string): Promise<void> {
    const args = command.map((part) => (part === '{dir}' ? dir : part));
    const child = spawn('npx', ['-y', ...args], { cwd: parent, stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, CI: '1' } });
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    const [code] = await once(child, 'close') as [number | null];
    if (code !== 0) throw new Error(`${command[0]} could not write the app's shell:\n${stderr.trim()}`);
  }
}
