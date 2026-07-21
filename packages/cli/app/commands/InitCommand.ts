import { existsSync } from 'node:fs';
import { join } from 'node:path';
import Init from '../../fronds/scaffold/entities/Init.js';
import { createAppRunner } from '@fougere/core';
import type { ui as createUi } from '@fougere/cli-ui';
import type { App } from '@fougere/core';

type Ui = ReturnType<typeof createUi>;

/** `fougere init <name>` — a bare workspace shell. Use `add` (or `new`) to fill it. */
export default class InitCommand {
  constructor(private app: App, private ui: Ui) {}

  async run(raw: Record<string, unknown>) {
    if (!raw.name) {
      raw.name = await this.ui.text({ message: 'Workspace name?', placeholder: 'shop' });
    }

    const dir = join(process.cwd(), raw.name as string);
    if (existsSync(dir) && !raw.force) {
      const overwrite = await this.ui.confirm({ message: `${raw.name}/ already exists. Overwrite?` });
      if (!overwrite) { this.ui.cancel(); return; }
    }

    const result = Init.validate(raw);
    if (!result.success) {
      result.errors.forEach((e) => this.ui.error(`${e.path}: ${e.message}`));
      return;
    }

    const s = this.ui.spinner('Creating workspace...');
    const out = await createAppRunner(this.app)(
      { entity: 'init', op: 'execute' },
      { params: {}, query: {}, body: result.data, state: {} },
    );
    const { path } = out as { path: string };
    s.stop(`Created ${path}/`);

    this.ui.note([`cd ${raw.name}`, `fougere new   # or: fougere add`].join('\n'), 'Next steps');
    this.ui.outro('Done.');
  }
}
