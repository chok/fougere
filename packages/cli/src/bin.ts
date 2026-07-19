#!/usr/bin/env node
/**
 * fougere CLI — a Fougere app powered by citty.
 *
 * src/   → compiled (tsc → dist/)
 * fronds/ → loaded at runtime by jiti (domain)
 * app/   → loaded at runtime by jiti (presentation)
 */
import { createApp, setModuleLoader } from '@fougere/core';
import { createContainer } from '@fougere/container-fougere';
import { ui } from '@fougere/cli-ui';
import { run } from './runner.js';

const { createJiti } = await import('jiti');
const jiti = createJiti(import.meta.url, { interopDefault: true });
setModuleLoader((filePath) => jiti.import(filePath) as Promise<Record<string, unknown>>);

const cliRoot = new URL('..', import.meta.url).pathname;
const container = createContainer();
container.registerValue('ui', ui());
container.registerValue('cwd', process.cwd());

const app = await createApp({
  root: cliRoot,
  createContainer: () => container,
});

container.registerValue('app', app);

await run(app);
