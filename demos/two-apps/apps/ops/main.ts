import { setLogLevel } from '@fougere/core';
import { serve } from '@fougere/oclif';
import { bootOps } from './boot.js';

setLogLevel('error');

const app = await bootOps();
await serve(app);
await app.dispose();
