/**
 * The doors as Express middlewares — the form an Express app expects.
 *
 * ```ts
 * const app = express();
 * app.use(express.json());
 * app.use(fougere());          // ← one line, like cors() or express.json()
 * ```
 *
 * This replaces an earlier `mountDoors(createExpressRouter(app))`, which was wrong in
 * two ways at once. It handed the app INTO a function instead of adding something to
 * the app, and it made the caller name Express 5's wildcard syntax (`/api/*splat`) —
 * a detail that belongs to the framework, not to its user. Worse, it mounted all
 * three doors together with no way to take two of them.
 *
 * A middleware fixes both by construction, because Express already says WHERE:
 *
 * ```ts
 * app.use(fougere());                 // the three doors, at the paths the client knows
 * app.use('/admin', fougereRest());   // REST only, wherever you want it
 * ```
 *
 * And `next()` is the passthrough these doors were already imitating: `serveRest`
 * answers `{ kind: 'pass' }` for a path it does not serve, which is exactly what
 * Express means by calling the next handler. The middleware stops inventing it.
 *
 * The names mirror `@fougere/app/web` on purpose — same doors, host-shaped. `/web`
 * gives you `Request` → `Response` handlers; this gives you middlewares.
 *
 * Nothing here imports express: the shapes are structural, so the package keeps its
 * dependency list and a test can hand it a plain object.
 */
import { readExpressBody } from '@fougere/http';
import { serveRest, serveRpc, rpcParseError } from './serve.js';
import { serveGraphQL } from './graphql.js';
import { sessionViewOf } from './session.js';
import { useFougereApp } from './boot.js';

/** What a middleware reads off an Express request. Structural, not imported. */
interface ExpressRequest {
  method: string;
  path?: string;
  originalUrl?: string;
  url?: string;
  query?: Record<string, unknown>;
  headers?: Record<string, unknown>;
  body?: unknown;
  /** Filled by an auth middleware that ran before us, if any. */
  fougereState?: Record<string, unknown>;
  user?: unknown;
}

interface ExpressResponse {
  status(code: number): ExpressResponse;
  set(field: string, value: unknown): ExpressResponse;
  json(body: unknown): unknown;
}

type Next = (err?: unknown) => void;
export type ExpressMiddleware = (req: any, res: any, next: Next) => void;

/**
 * Who the caller is, from what ran before.
 *
 * Express has no ambient request, so an app that resolves its own session says so by
 * putting it on the request — `req.fougereState`, or a bare `req.user`, which is what
 * passport and most middlewares already set. Nothing is taken from the payload: the
 * browser sits outside the topology.
 */
function stateOf(req: ExpressRequest): Record<string, unknown> {
  if (req.fougereState) return req.fougereState;
  return req.user ? { user: req.user } : {};
}

function pathOf(req: ExpressRequest): string {
  return req.path ?? String(req.originalUrl ?? req.url ?? '').split('?')[0]!;
}

function queryOf(req: ExpressRequest): Record<string, string> {
  return Object.fromEntries(
    Object.entries(req.query ?? {}).map(([key, value]) => [
      key,
      String(Array.isArray(value) ? value[0] : value),
    ]),
  );
}

/** Turn a thrown failure into Express's own error pipeline, unless it is a refusal we own. */
function fail(res: ExpressResponse, next: Next, err: unknown): void {
  const code = (err as { name?: string })?.name === 'MalformedJsonError' ? 400 : 0;
  if (code === 400) {
    res.status(400).json({ code: 'BAD_REQUEST', message: 'Malformed JSON body' });
    return;
  }
  next(err);
}

/**
 * The call envelope, at `/_fougere/call` — the door the browser primitives use.
 *
 * Mounted with `app.use()`, Express strips nothing, so the path still carries the
 * audience segment (`/_fougere/call/public`) that `surfaceOf` reads.
 */
export function fougereCall(mountPath = '/_fougere/call'): ExpressMiddleware {
  return (req, res, next) => {
    const path = pathOf(req);
    if (req.method !== 'POST' || !path.startsWith(mountPath)) return next();

    void (async () => {
      try {
        const app = await useFougereApp();
        let body: unknown;
        try {
          body = await readExpressBody(req);
        } catch {
          res.status(200).json(rpcParseError());
          return;
        }
        res.status(200).json(await serveRpc(app, { path, body, state: stateOf(req) }));
      } catch (err) {
        fail(res, next, err);
      }
    })();
  };
}

/** The session view, at `/_fougere/session`. */
export function fougereSession(mountPath = '/_fougere/session'): ExpressMiddleware {
  return (req, res, next) => {
    if (req.method !== 'GET' || pathOf(req) !== mountPath) return next();
    res.status(200).json(sessionViewOf(stateOf(req)));
  };
}

/**
 * The REST projection, under `/api` by default.
 *
 * A path this app does not serve calls `next()` — so an app's own `/api/health` keeps
 * answering whether it was registered before or after this middleware.
 */
export function fougereRest(mountPath = '/api'): ExpressMiddleware {
  return (req, res, next) => {
    const path = pathOf(req);
    if (!path.startsWith(`${mountPath}/`)) return next();

    void (async () => {
      try {
        const app = await useFougereApp();
        const outcome = await serveRest(app, {
          method: req.method,
          path: path.slice(mountPath.length + 1),
          query: queryOf(req),
          body: await readExpressBody(req),
          state: stateOf(req),
        });

        // Not ours — Express's own passthrough, which is what `pass` always meant.
        if (outcome.kind === 'pass') return next();

        if (outcome.kind === 'error' && outcome.headers) {
          for (const [key, value] of Object.entries(outcome.headers)) res.set(key, value);
        }
        res.status(outcome.status).json(outcome.body);
      } catch (err) {
        fail(res, next, err);
      }
    })();
  };
}

/** GraphQL, at `/graphql` by default. Declines when the app declares no such adapter. */
export function fougereGraphQL(mountPath = '/graphql'): ExpressMiddleware {
  return (req, res, next) => {
    if (req.method !== 'POST' || pathOf(req) !== mountPath) return next();

    void (async () => {
      try {
        const app = await useFougereApp();
        const body = ((await readExpressBody(req)) ?? {}) as {
          query?: string;
          variables?: Record<string, unknown>;
          operationName?: string;
        };
        const outcome = await serveGraphQL(app, { ...body, state: stateOf(req) });
        if (outcome.kind === 'pass') return next();
        res.status(outcome.status).json(outcome.body);
      } catch (err) {
        fail(res, next, err);
      }
    })();
  };
}

/** Every door, for an app that wants all of them. What each one SERVES is still the
 *  app's declaration — mounting is not publishing. */
export function fougere(): ExpressMiddleware {
  const doors = [fougereCall(), fougereSession(), fougereRest(), fougereGraphQL()];
  return (req, res, next) => {
    let index = 0;
    const step = (err?: unknown) => {
      if (err) return next(err);
      const door = doors[index++];
      if (!door) return next();
      door(req, res, step);
    };
    step();
  };
}
