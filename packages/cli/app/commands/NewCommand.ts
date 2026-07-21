import { existsSync } from 'node:fs';
import { join } from 'node:path';
import ProjectWriter from '../../fronds/scaffold/services/ProjectWriter.js';
import type { ui as createUi } from '@fougere/cli-ui';
import type { App } from '@fougere/core';

type Ui = ReturnType<typeof createUi>;

/**
 * The guided composer: a workspace, then its fronds (domains), then the apps
 * that consume them — in that dependency order. ProjectWriter is a plain,
 * dependency-free service, so the presentation command drives it directly.
 */
export default class NewCommand {
  constructor(private app: App, private ui: Ui) {}

  async run(raw: Record<string, unknown>) {
    const pw = new ProjectWriter();

    let name = raw.name as string | undefined;
    if (!name) name = (await this.ui.text({ message: 'Workspace', placeholder: 'shop' })) as string;

    const dir = join(process.cwd(), name);
    if (existsSync(dir) && !raw.force) {
      const ok = await this.ui.confirm({ message: `${name}/ existe déjà. Écraser ?` });
      if (!ok) { this.ui.cancel(); return; }
    }

    pw.createWorkspace(dir, name);

    if (raw.bare) {
      this.ui.note([`cd ${name}`, `fougere new   # compose it (guided)`].join('\n'), `${name} — empty workspace`);
      this.ui.outro('Prêt.');
      return;
    }

    const fronds = await this.compose(dir, pw, 'fronds', 'Fronds — tes domaines', pw.listTemplates('fronds'));
    const apps = await this.compose(dir, pw, 'apps', 'Apps — ce qui les consomme', pw.listTemplates('apps'));

    if (raw.local) pw.linkLocal(dir);
    const install = raw.local ? 'pnpm install' : 'pnpm install   # needs @fougere/* published (or re-run with --local)';
    this.ui.note([`cd ${name}`, install, `pnpm dev`].join('\n'), `${name} — ${fronds} frond(s), ${apps} app(s)`);
    this.ui.outro('Prêt.');
  }

  /** One phase — loop "template → name" until the user is done. Returns the count added. */
  private async compose(
    dir: string,
    pw: ProjectWriter,
    kind: 'fronds' | 'apps',
    header: string,
    templates: string[],
  ): Promise<number> {
    this.ui.step(header);
    let count = 0;
    for (;;) {
      const doneLabel = count === 0 ? (kind === 'fronds' ? 'passer' : 'aucune') : 'terminé';
      const template = (await this.ui.select({
        message: count === 0 ? 'Template' : 'Encore un ?',
        options: [...templates.map((v) => ({ value: v, label: v })), { value: '__done__', label: doneLabel }],
      })) as string;
      if (template === '__done__') break;

      const itemName = (await this.ui.text({ message: 'Nom' })) as string;
      if (kind === 'fronds') pw.addFrond(dir, template, itemName);
      else pw.addApp(dir, template, itemName);
      this.ui.info(`${kind}/${itemName}`);
      count++;
    }
    return count;
  }
}
