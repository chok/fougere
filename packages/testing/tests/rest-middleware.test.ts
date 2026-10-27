/**
 * A link at a frond's REST door stands around its REST requests and no other: it reads the headers
 * before the body is read, refuses by throwing, and decorates the answer — and a call reaching the
 * same op through JSON-RPC never meets it.
 */
import { describe, expect, it } from 'vitest';
import { openApiOf, Rest, type ResponseResult, type RestRequest, type RestResponse } from '@fougere/adapter-rest';
import { configureFougere, tableOf, useFougereApp } from '@fougere/app';
import { answered, called } from './web.js';
import { createContainer } from '@fougere/container';
import { createApp, ErrorCode, FougereError, frond } from '@fougere/core';
import { entity, primary, text } from '@fougere/schema';

class Note extends entity({ id: primary(), title: text() }) {}
class NoteHandler {
  find(id: string): Note { return { id, title: 'kept' } as Note; }
  write(title: string): Note { return { id: 'n1', title } as Note; }
}

class Powered implements Partial<Rest> {
  constructor(private inner: Rest) {}
  async answer(request: RestRequest): Promise<ResponseResult> {
    const answer = await this.inner.answer(request);

    return { ...answer, headers: { ...answer.headers, 'x-frond': 'desk' } };
  }
}

class UploadLimit implements Partial<Rest> {
  constructor(private inner: Rest) {}
  async answer(request: RestRequest): Promise<ResponseResult> {
    if (Number(request.headers.get('content-length')) > 1000) {
      throw new FougereError({ code: ErrorCode.PAYLOAD_TOO_LARGE, message: 'Notes stop at 1000 bytes.' });
    }

    return this.inner.answer(request);
  }
}

/** One handler's ops, by name: an old id is moved, every other op goes straight through. */
class NoteRest extends Rest<NoteHandler> {
  constructor(inner: Rest<NoteHandler>) { super(inner); }
  async find(request: RestRequest): Promise<ResponseResult | RestResponse<301, { location: string }>> {
    if (request.params.id === 'old') return { status: 301, headers: { location: '/api/desk/notes/n1/find' }, data: null };

    return this.inner!.answer(request);
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
    providers: [
      { ctor: Powered, deps: ['Rest'], implements: ['Rest'] },
      { ctor: UploadLimit, deps: ['Rest'], implements: ['Rest'] },
      { ctor: NoteRest, deps: ['Rest<NoteHandler>'], implements: ['Rest<NoteHandler>'], answers: { find: [{ status: 301, headers: ['location'] }] } },
    ],
    ports: { Rest: ['Powered', 'UploadLimit'] },
  })],
});
const app = await useFougereApp();

describe('a REST middleware', () => {
  it('decorates the answer, a refusal included', async () => {
    const found = await answered(app, 'GET', '/api/desk/notes/n1/find');
    const refused = await answered(app, 'POST', '/api/desk/notes/write/x', { headers: { 'content-length': '5000' }, body: { title: 'x' } });

    expect(found).toMatchObject({ status: 200, headers: { 'x-frond': 'desk' } });
    expect(refused).toMatchObject({ status: 413, headers: { 'x-frond': 'desk' } });
  });

  it('refuses on the headers before the body is read', async () => {
    let read = false;
    const stream = new ReadableStream<Uint8Array>({ pull(controller) { read = true; controller.close(); } }, { highWaterMark: 0 });
    const answer = await answered(app, 'POST', '/api/desk/notes/write/x', { headers: { 'content-length': '5000' }, stream });

    expect(answer).toMatchObject({ status: 413, body: { code: 'PAYLOAD_TOO_LARGE', message: 'Notes stop at 1000 bytes.' } });
    expect(read).toBe(false);
  });

  it('stands at its door only: the same op through JSON-RPC never meets it', async () => {
    const answer = (await called(app, 'note.write', { params: { title: 'x' } })).body;

    expect(answer).toMatchObject({ result: { title: 'x' } });
  });

  it('stands around one handler\'s op by name, and may answer in its place', async () => {
    const moved = await answered(app, 'GET', '/api/desk/notes/old/find');
    const written = await answered(app, 'POST', '/api/desk/notes/write/x');

    expect(moved).toMatchObject({ status: 301, headers: { location: '/api/desk/notes/n1/find', 'x-frond': 'desk' } });
    expect(written).toMatchObject({ status: 201, body: { title: 'x' } });
  });

  it('refuses the boot for a method naming no operation of its handler', async () => {
    class Misspelt extends Rest<NoteHandler> {
      constructor(inner: Rest<NoteHandler>) { super(inner); }
      async fnid(request: RestRequest): Promise<ResponseResult> { return this.inner!.answer(request); }
    }
    const desk = frond('desk', {
      entities: [Note],
      handlers: [{ ctor: NoteHandler, operations: { find: { params: { id: [Note, 'id'] }, output: Note } } }],
      providers: [{ ctor: Misspelt, deps: ['Rest<NoteHandler>'], implements: ['Rest<NoteHandler>'] }],
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
