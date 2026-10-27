/** The app's answer for a host that routes by file — it boots the app, and hands each request to `answer`. */
import { answerAt, BootRefusal, ErrorCode, FougereError } from '@fougere/core';
import { pageDoor } from '@fougere/transport-http/receive';
import { prefixOf } from '@fougere/adapter-rest';
import { answer, CALL_PATH, type AnswerOptions } from './answer.js';
import { GRAPHQL_PATH, graphqlSurfaceOf } from './graphql.js';
import { useFougereApp, useFougereConfig } from './boot.js';

/**
 * The app's answer, for a host that routes by FILE and hands every request of a route here: the app
 * boots at the first one, and a request no door answers is a 404 that says why.
 */
export async function fougere(request: Request, options: AnswerOptions = {}): Promise<Response> {
  const app = await useFougereApp().catch((failure: unknown) => {
    if (failure instanceof BootRefusal) return failure;
    throw failure;
  });
  if (app instanceof BootRefusal) return refused(app, request);

  return (await answer(app, request, options)) ?? notFound(request);
}

/**
 * Every call while the boot is refused, framed like any refused op so a page shows it where it
 * shows one. Its words name tables and columns, so they leave the process only outside production.
 */
async function refused(refusal: BootRefusal, request: Request): Promise<Response> {
  console.error(refusal.message);
  const message = process.env.NODE_ENV === 'production' ? 'The app refused to start.' : refusal.message;
  if (!new URL(request.url).pathname.startsWith(CALL_PATH)) return Response.json({ message }, { status: 503 });

  const unavailable = pageDoor(async () => { throw new FougereError({ code: ErrorCode.SERVICE_UNAVAILABLE, message }); }, { state: {} });

  return Response.json(await answerAt(unavailable, await request.json().catch(() => ({}))));
}

/**
 * A host that routes by FILE mounts a door where the file sits, and a config cannot move a file.
 * Saying so is what keeps a stale route file from reading as an app with no routes.
 */
async function notFound(request: Request): Promise<Response> {
  const { pathname } = new URL(request.url);
  if (pathname === GRAPHQL_PATH || graphqlSurfaceOf(pathname)) {
    return Response.json({ message: 'GraphQL is not served by this app' }, { status: 404 });
  }
  const prefix = prefixOf((await useFougereConfig()).protocols);
  if (!pathname.startsWith('/_fougere/') && !pathname.startsWith(`${prefix}/`)) {
    return Response.json({
      message: `${pathname} is not under the REST prefix ${prefix}. Move the route file that hands it here `
        + `under ${prefix}, or change protocols.rest.prefix.`,
    }, { status: 404 });
  }

  return Response.json({ message: `No route for ${request.method.toUpperCase()} ${pathname}` }, { status: 404 });
}
