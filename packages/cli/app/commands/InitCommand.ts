import { existsSync } from 'node:fs';
import { join } from 'node:path';
import Init from '../../fronds/scaffold/entities/Init.js';
import type { ui as createUi } from '@fougere/cli-ui';
import type { App } from '@fougere/core';

type Ui = ReturnType<typeof createUi>;

export default class InitCommand {
  constructor(private app: App, private ui: Ui) {}

  async run(raw: Record<string, unknown>) {
    if (!raw.name) {
      raw.name = await this.ui.text({ message: 'Project name?', placeholder: 'my-app' });
    }
    if (!raw.template) {
      raw.template = await this.ui.select({
        message: 'Template?',
        options: [
          { value: 'admin', label: 'Admin', hint: 'Dashboard with CRUD' },
          { value: 'blog', label: 'Blog', hint: 'Blog with posts and authors' },
          { value: 'api', label: 'API', hint: 'GraphQL API only' },
          { value: 'blankosse', label: 'Blankosse', hint: 'Empty project' },
        ],
      });
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

    const s = this.ui.spinner('Scaffolding...');
    const handler = this.app.resolve<{ execute: (input: typeof result.data) => Promise<{ path: string }> }>('initHandler');
    const { path } = await handler.execute(result.data);
    s.stop(`Created ${path}/`);

    this.ui.note([`cd ${raw.name}`, `pnpm install`, `pnpm dev`].join('\n'), 'Next steps');
    this.ui.outro('Done.');
  }
}
