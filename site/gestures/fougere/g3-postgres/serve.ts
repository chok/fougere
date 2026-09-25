import { createJiti } from 'jiti';
import { createLocalRunner } from '@fougere/core';
import { frondAliases } from '@fougere/compiler';
import { setModuleLoader } from '@fougere/core/node';
import { bootApp } from '@fougere/defaults';
import { serve } from '@fougere/transport-http';

const jiti = createJiti(import.meta.url, { interopDefault: true, alias: await frondAliases(process.cwd()) });
setModuleLoader((filePath: string) => jiti.import(filePath) as Promise<Record<string, unknown>>);

const app = await bootApp(process.cwd());
await serve(createLocalRunner(app), { port: Number(process.env.PORT ?? 4000) });
