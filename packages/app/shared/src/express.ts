/** The app as an Express middleware — the form an Express app expects. */
import { NodeRequest, sendNodeResponse } from 'srvx/node';
import { answer } from './answer.js';
import { useFougereApp } from './boot.js';

/** What the middleware reads off an Express request. Structural, not imported. */
interface ExpressRequest {
  method: string;
  originalUrl?: string;
  url?: string;
  protocol?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  /** Filled by an auth middleware that ran before us, if any. */
  fougereState?: Record<string, unknown>;
  user?: unknown;
}

type Next = (err?: unknown) => void;
export type ExpressMiddleware = (req: any, res: any, next: Next) => void;

/**
 * Every door of the app. What each one SERVES is still the app's declaration — mounting is not
 * publishing — and a request none of them answers goes on to the app's own routes.
 */
export function fougere(): ExpressMiddleware {
  return (req, res, next) => {
    const request = requestOf(req, res);

    void (async () => {
      try {
        const answered = await answer(await useFougereApp(), request, { state: stateOf(req) });
        if (!answered) return next();
        await sendNodeResponse(res, answered);
      } catch (err) {
        next(err);
      }
    })();
  };
}

/** Who the caller is, from what ran before. */
function stateOf(req: ExpressRequest): Record<string, unknown> {
  if (req.fougereState) return req.fougereState;

  return req.user ? { user: req.user } : {};
}

/** A body a parser already read is gone from the stream, so it is handed over as what it parsed. */
function requestOf(req: ExpressRequest, res: unknown): Request {
  const method = req.method.toUpperCase();
  if (req.body === undefined || method === 'GET' || method === 'HEAD') return new NodeRequest({ req: req as never, res: res as never });

  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
  }
  headers.set('content-type', 'application/json');
  headers.delete('content-length');

  return new Request(`${req.protocol ?? 'http'}://${headers.get('host') ?? 'localhost'}${req.originalUrl ?? req.url}`, {
    method,
    headers,
    body: JSON.stringify(req.body),
  });
}
