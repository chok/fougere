/** fougere CLI — a Fougere app powered by citty. */
import { createApp, setLogLevel, envLevel } from '@fougere/core';
import { createContainer } from '@fougere/container';
import fronds, * as statement from '../.fougere/fronds.generated.js';
import { ui } from './ui.js';
import { run } from './runner.js';

const container = createContainer();
const terminal = ui();
container.registerValue('ui', terminal);
container.registerValue('cwd', process.cwd());

setLogLevel(envLevel() ?? 'warn');

const app = await createApp({ fronds, vocabulary: statement.vocabulary, createContainer: () => container });

container.registerValue('app', app);

await run(app);
