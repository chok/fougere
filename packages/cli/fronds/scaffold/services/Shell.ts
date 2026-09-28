import { execFileSync } from 'node:child_process';

/** Runs a host's own scaffolder — the one step of `fougere new` that reaches the network. */
export default class Shell {
  /** Writes the host's shell at `parent/dir`. `{dir}` in the command stands for `dir`. */
  create(command: readonly string[], parent: string, dir: string): void {
    const args = command.map((part) => (part === '{dir}' ? dir : part));
    try {
      execFileSync('npx', ['-y', ...args], { cwd: parent, stdio: 'pipe', env: { ...process.env, CI: '1' } });
    } catch (error) {
      const { stderr = '' } = error as { stderr?: Buffer | string };
      throw new Error(`${command[0]} could not write the app's shell:\n${String(stderr).trim()}`, { cause: error });
    }
  }
}
