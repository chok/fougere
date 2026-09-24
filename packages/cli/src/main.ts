/** fougere CLI — a Fougere app powered by citty. */
import { createApp, setLogLevel, envLevel } from '@fougere/core';
import { createContainer } from '@fougere/container';
import { scan } from '../.fougere/scan.generated.js';
import { ui } from './ui.js';
import { run } from './runner.js';
import { installLoader } from './loader.js';

await installLoader(process.cwd());

const container = createContainer();
const terminal = ui();
container.registerValue('ui', terminal);
container.registerValue('cwd', process.cwd());

// The CLI is a Fougere app — silence its boot chatter unless explicitly asked. The
// threshold is SET, not only announced: a static import evaluates the logger module,
// its env read included, before this line runs.
process.env.FOUGERE_LOG_LEVEL ??= 'warn';
setLogLevel(envLevel() ?? 'warn');

const app = await createApp({ scan, createContainer: () => container });

container.registerValue('app', app);

await run(app);
