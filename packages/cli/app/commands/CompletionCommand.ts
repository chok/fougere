import type { App } from '@fougere/core';
// `dist/`, not `src/` — app/ ships raw and is loaded by jiti at runtime, but the
// published package carries only dist/, app/, fronds/ and templates/.
import { generateZshCompletion, generateBashCompletion } from '../../dist/completion.js';

export default class CompletionCommand {
  constructor(private app: App) {}

  async run(raw: Record<string, unknown>) {
    const shell = (raw.shell as string) || detectShell();
    const script = shell === 'bash'
      ? generateBashCompletion(this.app)
      : generateZshCompletion(this.app);
    console.log(script);
  }
}

function detectShell(): string {
  const shell = process.env.SHELL ?? '';
  if (shell.includes('zsh')) return 'zsh';
  if (shell.includes('bash')) return 'bash';
  return 'zsh';
}
