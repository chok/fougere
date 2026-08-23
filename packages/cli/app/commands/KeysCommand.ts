import { mkdir, readFile, writeFile, appendFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { generateKeyPair } from '@fougere/core/node';
import type { App } from '@fougere/core';
import type { ui as createUi } from '../../src/ui.js';
import { ROOT_KEY, packed } from './grant-material.js';

type Ui = ReturnType<typeof createUi>;

/**
 * Create the authority — a command, not a service.
 *
 * This is the whole of it: it runs at deployment time and exits. Nothing stays alive,
 * nothing is joined at boot, and no frond reaches anything to prove who it is. What a
 * receiver ends up holding is ONE public key, so a frond granted tomorrow is admitted
 * by a receiver deployed today without its config being touched.
 *
 * The private key is written and never printed: it signs grants, and a grant is the
 * only thing that has to travel.
 */
export default class KeysCommand {
  constructor(private app: App, private ui: Ui) {}

  async run() {
    const path = join(process.cwd(), ROOT_KEY);
    if (await exists(path)) {
      this.ui.error(`${ROOT_KEY} already exists — a second root would split the system in two.`);
      this.ui.info('Delete it deliberately to start over; every grant issued so far stops being recognized.');
      return;
    }

    const { privateKey, publicKey } = generateKeyPair();
    await mkdir(join(process.cwd(), '.fougere'), { recursive: true });
    await writeFile(path, privateKey, { mode: 0o600 });
    await ignore(ROOT_KEY);

    this.ui.success(`root created — ${ROOT_KEY} (never commit it; added to .gitignore)`);
    this.ui.note(
      `FOUGERE_ROOT=${packed(publicKey)}`,
      'Every frond that ANSWERS — public, safe in an image or a manifest',
    );
    this.ui.info('Then `fougere grant <frond>` for each frond that CALLS.');
  }
}

async function exists(path: string): Promise<boolean> {
  return access(path).then(() => true, () => false);
}

/** Keep the root out of a commit — the one mistake that cannot be walked back. */
async function ignore(entry: string): Promise<void> {
  const path = join(process.cwd(), '.gitignore');
  const current = await readFile(path, 'utf8').catch(() => '');
  if (current.split('\n').some((line) => line.trim() === entry)) return;
  await appendFile(path, `${current.endsWith('\n') || current === '' ? '' : '\n'}${entry}\n`);
}
