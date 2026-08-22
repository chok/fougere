import { existsSync } from 'node:fs';
import { join } from 'node:path';
import ProjectWriter from '../../fronds/scaffold/services/ProjectWriter.js';
import type { ui as createUi } from '../../src/ui.js';
import type { App } from '@fougere/core';

type Ui = ReturnType<typeof createUi>;

/**
 * The same line either way, which is the point: `--local` links this checkout, the
 * default resolves `@fougere/*` from npm, and neither needs a caveat since the alpha
 * is published. It used to carry one, and a stale caveat is worse than none.
 */
const INSTALL = 'pnpm install';

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

    // A shape, decided before anything is written — the flat form has no workspace shell
    // to put the domain beside, because the root IS the domain.
    if (raw.flat) {
      if (raw.app) throw new Error('--flat is one app and it is the root — drop --app.');
      const template = ((raw.frond as string) || 'blank').split(':')[0].trim();
      const available = pw.listTemplates('fronds');
      if (!available.includes(template)) {
        throw new Error(`Unknown fronds template '${template}' — available: ${available.join(', ') || '(none)'}`);
      }
      pw.createFlat(dir, name);
      pw.addRootFrond(dir, template);
      if (raw.local) pw.linkLocal(dir);
      this.ui.info(`${template} at the root`);
      this.ui.note([`cd ${name}`, INSTALL, `pnpm dev`].join('\n'), `${name} — one frond, at the root`);
      this.ui.outro('Ready.');
      return;
    }

    pw.createWorkspace(dir, name);

    if (raw.bare) {
      if (raw.local) pw.linkLocal(dir);
      this.ui.note([`cd ${name}`, `fougere new   # compose it (guided)`].join('\n'), `${name} — empty workspace`);
      this.ui.outro('Ready.');
      return;
    }

    // Stated composition wins over the prompts: it is the only form a script, a CI
    // job or an agent can drive — the guided flow needs a TTY and hangs without one.
    const stated = (raw.frond as string) || (raw.app as string);
    const fronds = stated
      ? this.state(dir, pw, 'fronds', raw.frond as string)
      : await this.compose(dir, pw, 'fronds', 'Fronds — your domains', pw.listTemplates('fronds'));
    const apps = stated
      ? this.state(dir, pw, 'apps', raw.app as string)
      : await this.compose(dir, pw, 'apps', 'Apps — what consumes them', pw.listTemplates('apps'));

    // Every app depends on every frond — stated here, where both names are known.
    pw.linkFronds(dir);
    if (raw.local) pw.linkLocal(dir);
    this.ui.note([`cd ${name}`, INSTALL, `pnpm dev`].join('\n'), `${name} — ${fronds} frond(s), ${apps} app(s)`);
    this.ui.outro('Ready.');
  }

  /**
   * One phase, stated rather than prompted — `blog,api:catalog` is two pieces, the
   * second renamed. The template name is the default name: a piece you don't rename
   * is called what it is.
   */
  private state(dir: string, pw: ProjectWriter, kind: 'fronds' | 'apps', spec: string): number {
    const available = pw.listTemplates(kind);
    let count = 0;
    for (const piece of spec.split(',').map((s) => s.trim()).filter(Boolean)) {
      const [template, itemName = template] = piece.split(':');
      if (!available.includes(template)) {
        throw new Error(`Unknown ${kind} template '${template}' — available: ${available.join(', ') || '(none)'}`);
      }
      if (kind === 'fronds') pw.addFrond(dir, template, itemName);
      else pw.addApp(dir, template, itemName);
      this.ui.info(`${kind}/${itemName}`);
      count++;
    }
    return count;
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
