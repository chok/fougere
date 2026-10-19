/**
 * A frond's REST middleware stands around its REST requests and no other: it reads the headers
 * before the body is read, refuses by throwing, and decorates the answer — and a call reaching the
 * same op through JSON-RPC never meets it.
 */
import { describe, expect, it } from 'vitest';
import { RestMiddleware, type ResponseResult, type RestRequest } from '@fougere/adapter-rest';
import { configureFougere, serveRest, serveRpc, useFougereApp } from '@fougere/app';
import { ErrorCode, FougereError, frond } from '@fougere/core';
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

configureFougere({
  migrates: true,
  config: { protocols: { rest: {} } },
  fronds: [frond('desk', {
    entities: [Note],
    handlers: [{ ctor: NoteHandler, operations: {
      find: { params: { id: [Note, 'id'] }, output: Note },
      write: { params: { title: [Note, 'title'] }, output: Note },
    } }],
    middlewares: [Powered, UploadLimit],
    config: { middlewares: ['Powered', 'UploadLimit'] },
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
});
