/**
 * The live door — `tunnel.ts` whose listeners are not trusted peers.
 *
 * Read this against `demos/emit-multirepo/blog/tunnel.ts`, because everything the two
 * files share is deliberately unremarkable: a connection held open, a Map of listeners,
 * a fan-out driven by `onEmit`, an entry dropped on close. That was already proven there
 * and none of it is what this file is for. A socket is a socket.
 *
 * Two things differ, and they are the whole demo:
 *
 *   1. **A listener is not a peer.** The tunnel's listener introduces itself by naming the
 *      facts it accepts — read off its OWN signatures, because it is a Fougere process.
 *      A reader has no signatures and does not speak for the others, so the carrier has to
 *      decide who may be TOLD, and it decides from the fact.
 *
 *   2. **The push carries `{ entity }` and nothing else.** Not the row, not the title, not
 *      the id. A reader learns that something moved and must ask the judging door what it
 *      now sees. What a push does not carry, it cannot leak — and that turns the fan-out
 *      into a question of permission rather than of content.
 */
import { createServer, type Server, type ServerResponse } from 'node:http';

export interface Viewer {
  id: string;
  name: string;
}

/** Only what routing needs. `title` is not here, and that is the point. */
export interface Change {
  author: string;
  status: string;
}

/**
 * May this viewer be TOLD that a post moved? Not "may they read it" — that answer
 * belongs to the handler, and it is given again, later, when they ask.
 *
 * Two judges on the same question is not duplication here: they answer different
 * questions. This one gates a notification; `PostHandler.list` gates a row. Getting
 * this one wrong wastes a query. Getting that one wrong leaks a draft.
 */
const mayBeTold = (viewer: Viewer, change: Change): boolean =>
  change.status === 'published' || change.author === viewer.name;

export interface LiveDoor {
  port: number;
  /** Tell whoever may know that this entity moved. Returns the names told. */
  notify(entity: string, change: Change): string[];
  close(): Promise<void>;
}

export async function serveLive(): Promise<LiveDoor> {
  const connections = new Map<ServerResponse, Viewer>();

  const server: Server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://live');
    if (url.pathname !== '/live') return void res.writeHead(404).end();

    // The stand-in for auth. In an app this is the same middleware that fills
    // `state.user` on an ordinary call — the demo hand-rolls it so the whole
    // identity story stays visible in one file.
    const name = req.headers['x-viewer'];
    if (typeof name !== 'string') return void res.writeHead(401).end();

    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });
    res.write(': ready\n\n');
    connections.set(res, { id: `u-${name}`, name });

    req.on('close', () => connections.delete(res));
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port;

  return {
    port,
    notify(entity, change) {
      const told: string[] = [];
      for (const [res, viewer] of connections) {
        if (!mayBeTold(viewer, change)) continue;
        // The entire payload. One word, and it is a name the client already knows.
        res.write(`data: ${JSON.stringify({ entity })}\n\n`);
        told.push(viewer.name);
      }
      return told;
    },
    async close() {
      for (const res of connections.keys()) res.end();
      connections.clear();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

/**
 * A reader. Holds the connection, and on every nudge asks the door what it now sees —
 * which is the client half of "push the invalidation, not the row".
 *
 * The browser version of this is smaller, not bigger: `@fougere/app-shared` already
 * keeps a registry of mounted queries per entity (`mountedKeys`), so the body of
 * `onEntityMoved` there is one call to `revalidate`.
 */
export async function watch(
  port: number,
  viewer: string,
  onEntityMoved: (entity: string) => Promise<void>,
): Promise<() => void> {
  const controller = new AbortController();
  const response = await fetch(`http://127.0.0.1:${port}/live`, {
    headers: { 'x-viewer': viewer },
    signal: controller.signal,
  });

  void (async () => {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let cut: number;
        while ((cut = buffer.indexOf('\n\n')) >= 0) {
          const frame = buffer.slice(0, cut);
          buffer = buffer.slice(cut + 2);
          if (!frame.startsWith('data: ')) continue;
          const { entity } = JSON.parse(frame.slice(6)) as { entity: string };
          await onEntityMoved(entity);
        }
      }
    } catch {
      // The connection was closed by us. A real client reconnects here; nothing
      // is held either way, same trade as the tunnel.
    }
  })();

  return () => controller.abort();
}
