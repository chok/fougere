/**
 * A frond's REST middleware stands around its REST requests and no other: it reads the headers
 * before the body is read, refuses by throwing, and decorates the answer — and a call reaching the
 * same op through JSON-RPC never meets it.
 */
import { describe, expect, it } from 'vitest';
import { openApiOf, RestMiddleware, type ResponseResult, type RestRequest, type RestResponse } from '@fougere/adapter-rest';
import { configureFougere, serveRest, serveRpc, tableOf, useFougereApp } from '@fougere/app';
import { createContainer } from '@fougere/container';
import { createApp, ErrorCode, FougereError, frond } from '@fougere/core';
import { entity, primary, text } from '@fougere/schema';

class Note extends entity({ id: primary(), title: text() }) {}
class NoteHandler {
  find(id: string): Note { return { id, title: 'kept' } as Note; }
  write(title: string): Note { return { id: 'n1', title } as Note; }
}

class Powered extends RestMiddleware() {
  async around(_request: RestRequest, next: () => Promise<ResponseResult>): Promise<ResponseResult> {
    const answer = await next();

    return { ...answer, headers: { ...answer.headers, 'x-frond': 'desk' } };
  }
}

class UploadLimit extends RestMiddleware() {
  async around(request: RestRequest, next: () => Promise<ResponseResult>): Promise<ResponseResult> {
    if (Number(request.headers.get('content-length')) > 1000) {
      throw new FougereError({ code: ErrorCode.PAYLOAD_TOO_LARGE, message: 'Notes stop at 1000 bytes.' });
    }

    return next();
  }
}

/** One handler's ops, by name: an old id is moved, every other op goes straight through. */
class NoteRest extends RestMiddleware(NoteHandler) {
  async find(request: RestRequest, next: () => Promise<ResponseResult>): Promise<ResponseResult | RestResponse<301, { location: string }>> {
    if (request.params.id === 'old') return { status: 301, headers: { location: '/api/desk/notes/n1/find' }, data: null };

    return next();
  }
}

configureFougere({
  migrates: true,
  config: { protocols: { rest: {} } },
  fronds: [frond('desk', {
    entities: [Note],
    handlers: [{ ctor: NoteHandler, operations: {
      find: { params: { id: [Note, 'id'] }, output: Note },
      write: { params: { title: [Note, 'title'] }, output: Note },
    } }],
    // Stated by hand, as a `fronds.ts` with no scan writes it: what the scan would read off `find`.
    middlewares: [Powered, UploadLimit, { ctor: NoteRest, answers: { find: [{ status: 301, headers: ['location'] }] } }],
    config: { middlewares: ['Powered', 'UploadLimit', 'NoteRest'] },
  })],
});
const app = await useFougereApp();

describe('a REST middleware', () => {
  it('decorates the answer, a refusal included', async () => {
    const found = await serveRest(app, { method: 'GET', path: '/api/desk/notes/n1/find', query: {}, state: {} });
    const refused = await serveRest(app, {
      method: 'POST', path: '/api/desk/notes/write/x', query: {}, state: {},
      headers: new Headers({ 'content-length': '5000' }), body: async () => ({ title: 'x' }),
    });

    expect(found).toMatchObject({ kind: 'ok', status: 200, headers: { 'x-frond': 'desk' } });
    expect(refused).toMatchObject({ kind: 'error', status: 413, headers: { 'x-frond': 'desk' } });
  });

  it('refuses on the headers before the body is read', async () => {
    let read = false;
    const answer = await serveRest(app, {
      method: 'POST', path: '/api/desk/notes/write/x', query: {}, state: {},
      headers: new Headers({ 'content-length': '5000' }),
      body: async () => { read = true; return { title: 'x' }; },
    });

    expect(answer).toMatchObject({ status: 413, body: { code: 'PAYLOAD_TOO_LARGE', message: 'Notes stop at 1000 bytes.' } });
    expect(read).toBe(false);
  });

  it('stands at its door only: the same op through JSON-RPC never meets it', async () => {
    const answer = await serveRpc(app, {
      path: '/_fougere/call',
      body: { jsonrpc: '2.0', id: 1, method: 'note.write', params: { params: { title: 'x' } } },
      state: {},
    });

    expect(answer).toMatchObject({ result: { title: 'x' } });
  });

  it('stands around one handler\'s op by name, and may answer in its place', async () => {
    const moved = await serveRest(app, { method: 'GET', path: '/api/desk/notes/old/find', query: {}, state: {} });
    const written = await serveRest(app, {
      method: 'POST', path: '/api/desk/notes/write/x', query: {}, state: {}, body: async () => undefined,
    });

    expect(moved).toMatchObject({ kind: 'ok', status: 301, headers: { location: '/api/desk/notes/n1/find', 'x-frond': 'desk' } });
    expect(written).toMatchObject({ kind: 'ok', status: 201, body: { title: 'x' } });
  });

  it('refuses the boot for a method naming no operation of its handler', async () => {
    class Misspelt extends RestMiddleware(NoteHandler) {
      async fnid(_request: RestRequest, next: () => Promise<ResponseResult>): Promise<ResponseResult> { return next(); }
    }
    const desk = frond('desk', {
      entities: [Note],
      handlers: [{ ctor: NoteHandler, operations: { find: { params: { id: [Note, 'id'] }, output: Note } } }],
      middlewares: [Misspelt],
    });

    await expect(createApp({ fronds: [desk], createContainer, migrates: true } as never))
      .rejects.toThrow(/Misspelt\.fnid names no operation of NoteHandler, which serves find/);
  });

  it('publishes what it may answer in an op\'s place on that op\'s route, stated by hand', () => {
    const find = tableOf(app).find((row) => row.route.operationName === 'find')!.route;
    const write = tableOf(app).find((row) => row.route.operationName === 'write')!.route;

    expect(find.responses).toEqual([{ status: 301, headers: ['location'] }]);
    expect(write.responses).toBeUndefined();
  });

  it('is what the OpenAPI document says the op may answer besides its own', () => {
    const find = openApiOf(app).paths['/api/desk/notes/{id}/find']!.get as { responses: Record<string, unknown> };

    expect(find.responses['301']).toMatchObject({ headers: { location: { schema: { type: 'string' } } } });
  });
});
