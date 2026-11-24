/** The app's answer for a host that routes by file — it boots the app, and hands each request to `answer`. */
import { answerAt, BootRefusal, ErrorCode, FougereError, Protocols, type App } from '@fougere/core';
import { pageDoor } from '@fougere/transport-http/receive';
import { answer, CALL_PATH, type AnswerOptions } from './answer.js';
import { useFougereApp } from './boot.js';

/** The app's answer for a host that routes by file: boots at the first request, and a request no door answers is a 404. */
export async function fougere(request: Request, options: AnswerOptions = {}): Promise<Response> {
  const app = await useFougereApp().catch((failure: unknown) => {
    if (failure instanceof BootRefusal) return failure;
    throw failure;
  });
  if (app instanceof BootRefusal) return refused(app, request);

  return (await answer(app, request, options)) ?? notFound(app, request);
}

async function refused(refusal: BootRefusal, request: Request): Promise<Response> {
  console.error(refusal.message);
  const message = process.env.NODE_ENV === 'production' ? 'The app refused to start.' : refusal.message;
  if (!new URL(request.url).pathname.startsWith(CALL_PATH)) return Response.json({ message }, { status: 503 });

  const unavailable = pageDoor(async () => { throw new FougereError({ code: ErrorCode.SERVICE_UNAVAILABLE, message }); }, { state: {} });

  return Response.json(await answerAt(unavailable, await request.json().catch(() => ({}))));
}

function notFound(app: App, request: Request): Response {
  const { pathname } = new URL(request.url);
  const mounted = Object.entries(app.protocols).flatMap(([name, options]) => {
    const path = Protocols.resolve(name).mountedAt?.(options);

    return path === undefined ? [] : [[name, path] as const];
  });
  if (!pathname.startsWith('/_fougere/') && !mounted.some(([, path]) => pathname === path || pathname.startsWith(`${path}/`))) {
    const served = mounted.map(([name, path]) => `${name} under ${path}`).join(', ') || 'no protocol';

    return Response.json({
      message: `${pathname} is under no protocol this app serves (${served}). Move the route file that hands it here, `
        + 'or change where the protocol is mounted in protocols:.',
    }, { status: 404 });
  }

  return Response.json({ message: `No route for ${request.method.toUpperCase()} ${pathname}` }, { status: 404 });
}
