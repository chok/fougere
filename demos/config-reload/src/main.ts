/**
 * The config re-read while the app runs — one boot, one handler, one Logger object.
 *
 * The app is booted ONCE. Between the calls this file rewrites `fougere.config.ts` on
 * disk and sends the process a real SIGHUP. Nothing is rebuilt: the handler was
 * constructed at its first call and keeps the very Logger it was handed, because the
 * level is held for the process and consulted at each emission.
 */
import { boot, createLocalRunner, EMPTY_INVOCATION, loadConfig, applyConfig, logLevel } from '@fougere/core';
import { createContainer } from '@fougere/container';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const configPath = join(root, 'fougere.config.ts');

const write = (body: string) => writeFileSync(
  configPath,
  `import { defineFougere } from '@fougere/core';\n\nexport default defineFougere(${body});\n`,
);

const app = await boot({ root, createContainer });
const call = createLocalRunner(app);

// The host owns the process, so the host owns the signal. Core catches none — the
// logger it ships runs on Workers, where `process.on` does not exist.
//
// The host also holds the config in force: `applyConfig` compares against it to say what
// changed and did NOT take effect, instead of applying what it can and staying quiet.
let inForce = await loadConfig(root);
let reloaded: (() => void) | undefined;

process.on('SIGHUP', async () => {
  const next = await loadConfig(root, { fresh: true });
  const { applied, pending } = applyConfig(next, inForce);
  inForce = next;
  console.log(`   [SIGHUP] applied: ${applied.length ? applied.join(', ') : 'nothing'}`
    + `${pending.length ? `  |  changed, needs a rebuild: ${pending.join(', ')}` : ''}`);
  reloaded?.();
});

/**
 * Send the real signal and wait for the handler to have run.
 *
 * The timer is not ceremony: a signal listener does not keep Node's event loop alive on
 * its own, and this demo holds no socket the way a server would — without it the process
 * drains and the signal is never delivered.
 */
const hangUp = () => new Promise<void>((resolve) => {
  const awake = setInterval(() => {}, 20);
  reloaded = () => { clearInterval(awake); resolve(); };
  process.kill(process.pid, 'SIGHUP');
});

console.log(`\n1. fougere.config.ts says logLevel: 'warn' — the handler's two lines are swallowed`);
console.log('   →', JSON.stringify(await call({ entity: 'health', op: 'check' }, EMPTY_INVOCATION)));

console.log(`\n2. the file is rewritten to 'debug', and the process gets a real SIGHUP`);
write(`{ db: false, logLevel: 'debug' }`);
await hangUp();
console.log('   →', JSON.stringify(await call({ entity: 'health', op: 'check' }, EMPTY_INVOCATION)));

console.log(`\n3. the file also changes db — consulted vs consumed, and it says so`);
write(`{ db: 'sqlite', logLevel: 'error' }`);
await hangUp();
console.log('   →', JSON.stringify(await call({ entity: 'health', op: 'check' }, EMPTY_INVOCATION)));

write(`{\n  db: false,\n  logLevel: 'warn',\n}`);
// ── What a re-read cannot do: `db` above needed a rebuild, not a new value. ──
console.log(`\n4. a call is running; the app is drained before being released`);
const slow = call({ entity: 'health', op: 'slow' }, EMPTY_INVOCATION);
console.log(`   in flight: ${app.inFlight()}`);
await app.drain();
console.log(`   drained — in flight: ${app.inFlight()}, and the call answered: ${JSON.stringify(await slow)}`);
await app.dispose();

console.log(`\nOne boot, one handler instance, one Logger object. Level now: ${logLevel()}.\n`);
