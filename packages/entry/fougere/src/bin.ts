#!/usr/bin/env node
/** `fougere` — the CLI under its unscoped name, handing over to the project's own CLI when there is one. */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

function projectCliBin(directory: string): string | undefined {
  const manifest = join(directory, 'node_modules', '@fougere', 'cli', 'package.json');
  if (existsSync(manifest)) {
    const exported = (JSON.parse(readFileSync(manifest, 'utf8')) as { exports: Record<string, string> }).exports['./bin'];

    return exported ? join(dirname(manifest), exported) : undefined;
  }
  const parent = dirname(directory);

  return parent === directory ? undefined : projectCliBin(parent);
}

const projectBin = projectCliBin(process.cwd());
await (projectBin ? import(pathToFileURL(projectBin).href) : import('@fougere/cli/bin'));
