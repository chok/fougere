/**
 * Every operation of every frond, as a command.
 *
 * Try `--help`: the topics are the addresses, the flags are the entity's fields, and the
 * legal values of a closed set are listed because `oneOf` named them. Nothing below says
 * anything about a terminal.
 */
import { bootApp } from '@fougere/defaults';
import { setLogLevel } from '@fougere/core';
import { serve } from '@fougere/oclif';
import { join } from 'node:path';

// stdout is a protocol here — `--json` is meant to reach `jq`, and the boot writes with
// `console.info`. A refusal still reaches stderr, where a shell expects it.
setLogLevel('error');

const app = await bootApp(join(import.meta.dirname, '..', '..', '..'));

await serve(app);
await app.dispose();
