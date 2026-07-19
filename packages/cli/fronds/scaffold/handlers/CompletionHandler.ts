import type { App } from '@fougere/core';
import type { ui as createUi } from '@fougere/cli-ui';
import { generateZshCompletion, generateBashCompletion } from '@fougere/cli';

type Ui = ReturnType<typeof createUi>;

export default class CompletionHandler {
  private ui: Ui;
  private app: App;

  constructor(ui: Ui, app: App) {
    this.ui = ui;
    this.app = app;
  }

  async execute(input: { shell?: string }) {
    const shell = input.shell || detectShell();

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
