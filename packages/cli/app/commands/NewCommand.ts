import { spawnSync } from 'node:child_process';
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
    const catalog: Catalog = { fronds: writer.listTemplates('fronds'), apps: writer.listTemplates('apps') };
    const where = { cwd: process.cwd(), force: Boolean(raw.force) };
    const refusals = (plan: Plan) => refusalsOf(plan, catalog, where);
    const stated = planOf({ name: raw.name as string | undefined, frond: raw.frond as string, app: raw.app as string, bare: Boolean(raw.bare) });
    const guided = !stated;

    let plan = stated;
    if (!plan) {
      if (!process.stdin.isTTY) {
        throw new Error('No terminal to ask in. State the project: fougere new shop --frond blog --app nuxt, or --bare for the empty shell.');
      }
      plan = await new Composer((raw.name as string | undefined) ?? '', catalog, refusals).ask();
      if (!plan) return;
    }

    const refused = refusals(plan);
    if (refused.length) throw new Error(refused.join('\n'));

    const dir = join(where.cwd, plan.name);
    const spinner = this.ui.spinner(`Writing ${plan.name}/`);
    try {
      writer.write(plan, dir, { local: Boolean(raw.local), force: where.force });
    } catch (error) {
      spinner.stop('Nothing was written.');
      throw error;
    }
    spinner.stop(`${plan.name}/ written`);

    const installed = guided && await this.ui.confirm({ message: 'Install the dependencies now? (pnpm install)', initialValue: true })
      && spawnSync('pnpm', ['install'], { cwd: dir, stdio: 'inherit' }).status === 0;

    const next = [`cd ${plan.name}`, ...(installed ? [] : ['pnpm install']), ...(plan.apps.length ? ['pnpm dev'] : [])];
    this.ui.note(next.join('\n'), 'Next');
    if (guided) this.ui.info(`The same project, with no prompt:\n${commandOf(plan)}`);
    this.ui.outro('Ready.');
  }
}
