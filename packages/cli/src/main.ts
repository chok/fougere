/** fougere CLI — a Fougere app powered by citty. */
import { createApp, setLogLevel, envLevel } from '@fougere/core';
import { createContainer } from '@fougere/container';
import { scan } from '../.fougere/scan.generated.js';
import { ui } from './ui.js';
import { run } from './runner.js';

const container = createContainer();
const terminal = ui();
container.registerValue('ui', terminal);
container.registerValue('cwd', process.cwd());

// The CLI is a Fougere app — silence its boot chatter unless explicitly asked. Set on the
// threshold and never in the environment, which an app the CLI boots would read as the
// operator's word over its own `logLevel:`.
setLogLevel(envLevel() ?? 'warn');

const app = await createApp({ scan, createContainer: () => container });

container.registerValue('app', app);

await run(app);
