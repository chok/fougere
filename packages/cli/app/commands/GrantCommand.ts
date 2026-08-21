import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { generateKeyPair, issueGrant } from '@fougere/core';
import type { App } from '@fougere/core';
import type { ui as createUi } from '../../src/ui.js';
import { ROOT_KEY, packed } from './grant-material.js';

type Ui = ReturnType<typeof createUi>;

/**
 * Vouch for one frond: bind its name to a fresh key, signed by the root.
 *
 * The key is printed and never stored — it belongs to the deployment, not to the
 * repository. Re-running issues a NEW key rather than showing the old one, which is
 * what rotation is: run it again, redeploy that frond, and nobody else's config moves.
 */
export default class GrantCommand {
  constructor(private app: App, private ui: Ui) {}

  async run(raw: Record<string, unknown>) {
    const frond = raw.frond as string | undefined;
    if (!frond) {
      this.ui.error('Usage: fougere grant <frond>');
      return;
    }

    let rootPrivateKey: string;
    try {
      rootPrivateKey = await readFile(join(process.cwd(), ROOT_KEY), 'utf8');
    } catch {
      this.ui.error(`No ${ROOT_KEY} — run \`fougere keys\` first.`);
      return;
    }

    const { privateKey, publicKey } = generateKeyPair();
    const grant = issueGrant(rootPrivateKey, frond, publicKey);

    this.ui.success(`granted — '${frond}' will be admitted by any receiver trusting this root`);
    this.ui.note(
      `FOUGERE_KEY=${packed(privateKey)}\nFOUGERE_GRANT=${grant}`,
      `Inject into '${frond}' at launch — secret, shown once`,
    );
  }
}
