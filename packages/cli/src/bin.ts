#!/usr/bin/env node
/**
 * fougere CLI — a Fougere app powered by citty.
 *
 * src/   → compiled (tsc → dist/)
 * fronds/ → loaded at runtime by jiti (domain)
 * app/   → loaded at runtime by jiti (presentation)
 */
import { createApp, setModuleLoader, setLogLevel, envLevel } from '@fougere/core';
import { createContainer } from '@fougere/container';
import { ui } from './ui.js';
import { run } from './runner.js';

const { createJiti } = await import('jiti');
const jiti = createJiti(import.meta.url, { interopDefault: true });
setModuleLoader((filePath) => jiti.import(filePath) as Promise<Record<string, unknown>>);

const cliRoot = new URL('..', import.meta.url).pathname;
const container = createContainer();
container.registerValue('ui', ui());
container.registerValue('cwd', process.cwd());

// The CLI is a Fougere app — silence its boot chatter unless explicitly asked. The
// threshold is SET, not only announced: a static import evaluates the logger module,
// its env read included, before this line runs.
process.env.FOUGERE_LOG_LEVEL ??= 'warn';
setLogLevel(envLevel() ?? 'warn');

const app = await createApp({
  root: cliRoot,
  createContainer: () => container,
});

container.registerValue('app', app);

await run(app);
