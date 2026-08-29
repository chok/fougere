/**
 * The blog Frond, alone in its process — the gradient lived.
 *
 * Same `fronds/**` as the Nuxt app: only the runtime moves. The address is declared
 * ONCE, in `fougere.config.ts` under `remotes:`, and this process binds exactly what
 * the consumer was told to call. Writing the port here too put one number in two
 * files, and nothing made them agree.
 */
import { createJiti } from 'jiti';
import { createApp, createLocalRunner, Logger } from '@fougere/core';
import { scanProject, setModuleLoader, frondAliases, loadConfig } from '@fougere/core/node';
import { createContainer } from '@fougere/container';
import { migrate } from '@fougere/adapter-sql';
import { setupSqlite } from '@fougere/adapter-sql/sqlite';
import { serve } from '@fougere/transport-http';
import { calls } from '@fougere/calls';
import { observability } from '@fougere/observability';

// `frondAliases` is what makes `@fronds/user/entities/User.js` resolve — the named
// form a frond uses for its neighbour. Without it this entry point loaded frond
// sources through a bare jiti, and `CurrentUserCollector` died on that import
// while the very same code worked in-process under Nuxt.
const jiti = createJiti(import.meta.url, {
  interopDefault: true,
  alias: await frondAliases(process.cwd()),
});
setModuleLoader((filePath) => jiti.import(filePath));

// Commenting `remotes:` is how you take the frond back in-process, so its absence
// means this process has no caller — say that rather than binding a port nobody dials.
const { remotes } = await loadConfig(process.cwd());
const address = remotes?.blog;
if (!address) {
  throw new Error(
    'No `remotes.blog` in fougere.config.ts — that line is what sends calls here.\n'
    + '  Uncomment it to run the frond split, or drop this process and run the app in-process.',
  );
}
const { hostname, port: declaredPort } = new URL(address);

const log = new Logger('blog-host');
const { ormFactory, db } = setupSqlite({ path: './nuxt-blog.db' });

// The panel, on its own loopback port: every call this frond executes, as it happens.
// Click through the Nuxt app on :3000 and they land here — including the ones that
// arrived over the wire, which is the half a browser's devtools cannot show.
const app = await createApp({
  scan: await scanProject(process.cwd(), ['blog']),
  createContainer,
  ormFactory,
  extensions: [observability({ service: 'blog-host' }), calls({ panel: 4400 })],
});
await migrate({ fronds: app.fronds }, db);

const { port } = await serve(createLocalRunner(app), { port: Number(declaredPort), host: hostname });
log.info(`frond blog served — POST ${new URL('/_fougere/call', address).href} (bound :${port})`);
