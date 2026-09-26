import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import ProjectWriter from '../../fronds/scaffold/services/ProjectWriter.js';
import { Composer } from '../../src/composer/Composer.js';
import { type Catalog, type Plan, commandOf, planOf, refusalsOf } from '../../src/composer/Plan.js';
import type { ui as createUi } from '../../src/ui.js';
import type { App } from '@fougere/core';

type Ui = ReturnType<typeof createUi>;

/**
 * A plan, then one write. The flags state it — the only form a script, a CI job or an agent can
 * drive — and the composer builds it when they state nothing; either way nothing touches the disk
 * before the plan holds.
 */
export default class NewCommand {
  constructor(private app: App, private ui: Ui) {}

  async run(raw: Record<string, unknown>) {
    const writer = new ProjectWriter();
    const cwd = process.cwd();
    const catalog: Catalog = { fronds: writer.listTemplates('fronds'), apps: writer.listTemplates('apps') };
    const refusals = (plan: Plan, replace: boolean) => refusalsOf(plan, catalog, { cwd, replace });
    const exists = (name: string) => existsSync(join(cwd, name));
    const terminal = Boolean(process.stdin.isTTY);
    const stated = planOf({ name: raw.name as string | undefined, frond: raw.frond as string, app: raw.app as string, bare: Boolean(raw.bare) });

    let plan = stated;
    let replace = Boolean(raw.force);
    if (!plan) {
      if (!terminal) {
        throw new Error('No terminal to ask in. State the project: fougere new shop --frond blog --app nuxt, or --bare for the empty shell.');
      }
      const composed = await new Composer({ name: (raw.name as string | undefined) ?? '', catalog, exists, refusals }).ask();
      if (!composed) return;

      plan = composed.plan;
      replace ||= composed.overwrite;
    } else if (plan.name && exists(plan.name) && !replace && terminal) {
      replace = await this.ui.confirm({ message: `${plan.name}/ already exists. Replace it?`, initialValue: false });
      if (!replace) return this.ui.cancel('Nothing was written.');
    }

    const refused = refusals(plan, replace);
    if (refused.length) throw new Error(refused.join('\n'));

    const dir = join(cwd, plan.name);
    const spinner = this.ui.spinner(`Writing ${plan.name}/`);
    try {
      writer.write(plan, dir, { local: Boolean(raw.local), replace });
    } catch (error) {
      spinner.stop('Nothing was written.');
      throw error;
    }
    spinner.stop(`${plan.name}/ written`);

    const guided = !stated;
    const installed = guided && await this.ui.confirm({ message: 'Install the dependencies now? (pnpm install)', initialValue: true })
      && spawnSync('pnpm', ['install'], { cwd: dir, stdio: 'inherit' }).status === 0;

    const next = [`cd ${plan.name}`, ...(installed ? [] : ['pnpm install']), ...(plan.apps.length ? ['pnpm dev'] : [])];
    this.ui.note(next.join('\n'), 'Next');
    if (guided) this.ui.info(`The same project, with no prompt:\n${commandOf(plan)}`);
    this.ui.outro('Ready.');
  }
}
