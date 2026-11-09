import { readFile, writeFile, appendFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { generateKeyPair } from '@fougere/core/node';
import type { App } from '@fougere/core';
import type { ui as createUi } from '../../src/ui.js';
import { ROOT_KEY, packed } from './grant-material.js';

type Ui = ReturnType<typeof createUi>;

/** Creates the root key; it is written, never printed. */
export default class KeysCommand {
  constructor(private app: App, private ui: Ui) {}

  async run() {
    const path = join(process.cwd(), ROOT_KEY);
    if (await exists(path)) {
      this.ui.error(`${ROOT_KEY} already exists. Another one would not recognize the grants issued so far.`);
      this.ui.info('Delete it deliberately to start over; every grant issued so far stops being recognized.');

      return;
    }

    const { privateKey, publicKey } = generateKeyPair();
    await writeFile(path, privateKey, { mode: 0o600 });
    await ignore(ROOT_KEY);

    this.ui.success(`root created — ${ROOT_KEY} (never commit it; added to .gitignore)`);
    this.ui.note(
      `FOUGERE_ROOT_KEY=${packed(publicKey)}`,
      'Every frond that ANSWERS — public, safe in an image or a manifest',
    );
    this.ui.info('Then `fougere grant <frond>` for each frond that CALLS.');
  }
}

async function exists(path: string): Promise<boolean> {
  return access(path).then(() => true, () => false);
}

async function ignore(entry: string): Promise<void> {
  const path = join(process.cwd(), '.gitignore');
  const current = await readFile(path, 'utf8').catch(() => '');
  if (current.split('\n').some((line) => line.trim() === entry)) return;
  await appendFile(path, `${current.endsWith('\n') || current === '' ? '' : '\n'}${entry}\n`);
}
