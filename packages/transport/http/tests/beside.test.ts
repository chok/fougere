/**
 * A served frond answers its REST door beside the call envelope: what is not a call goes to
 * `beside`, and what it leaves, or no `beside` at all, is a 404.
 */
import { describe, it, expect } from 'vitest';
import { connect } from 'node:net';
import type { Transport } from '@fougere/core';
import { serve } from '../src/index.js';

const runner: Transport = async () => 'called';

describe('a receiver with a door beside it', () => {
  it('hands what is not a call to beside, body included', async () => {
    const receiver = await serve(runner, {
      beside: async (request) => (new URL(request.url).pathname === '/api/blog/posts'
        ? Response.json({ method: request.method, body: await request.json() }, { status: 201 })
        : undefined),
    });
    try {
      const answered = await fetch(`http://127.0.0.1:${receiver.port}/api/blog/posts`, {
        method: 'POST', body: '{"title":"x"}', headers: { 'content-type': 'application/json' },
      });

      expect(answered.status).toBe(201);
      expect(await answered.json()).toEqual({ method: 'POST', body: { title: 'x' } });
      expect((await fetch(`http://127.0.0.1:${receiver.port}/elsewhere`)).status).toBe(404);
    } finally {
      await receiver.close();
    }
  });

  it('answers 404 to what is not a call when nothing stands beside it', async () => {
    const receiver = await serve(runner);
    try {
      expect((await fetch(`http://127.0.0.1:${receiver.port}/api/blog/posts`)).status).toBe(404);
    } finally {
      await receiver.close();
    }
  });

  it('hands beside no body for a POST that declares none, as curl sends one', async () => {
    const receiver = await serve(runner, {
      beside: async (request) => Response.json({ body: (await request.text()) === '' }),
    });
    try {
      // Neither a length nor chunks: what `curl -X POST` writes, and what fetch never does.
      const raw = await new Promise<string>((resolve, reject) => {
        let answer = '';
        const socket = connect(receiver.port, '127.0.0.1', () => {
          socket.write('POST /api/blog/posts/p1/publish HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n');
        });
        socket.on('data', (chunk) => { answer += chunk; });
        socket.on('end', () => resolve(answer));
        socket.on('error', reject);
      });

      expect(raw).toContain('{"body":true}');
    } finally {
      await receiver.close();
    }
  });
});

describe('what stands around beside', () => {
  const stamp = (name: string) => async (request: Request, next: () => Promise<Response>) => {
    const answered = await next();
    const headers = new Headers(answered.headers);
    headers.append('x-trail', name);

    return new Response(answered.body, { status: answered.status, headers });
  };

  it('runs outside in, may answer in its place, and leaves the envelope alone', async () => {
    const receiver = await serve(runner, {
      beside: async () => Response.json({ beside: true }),
      use: [
        stamp('outer'),
        stamp('inner'),
        async (request, next) => (new URL(request.url).pathname === '/healthz' ? new Response('ok') : next()),
      ],
    });
    const base = `http://127.0.0.1:${receiver.port}`;
    try {
      const posts = await fetch(`${base}/api/blog/posts`);
      const health = await fetch(`${base}/healthz`);
      const call = await fetch(`${base}/_fougere/call`, {
        method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'post.list', params: {} }),
      });

      expect(await posts.json()).toEqual({ beside: true });
      expect(posts.headers.get('x-trail')).toBe('inner, outer');
      expect([health.status, await health.text(), health.headers.get('x-trail')]).toEqual([200, 'ok', 'inner, outer']);
      expect(call.headers.get('x-trail')).toBeNull();
      expect(await call.json()).toMatchObject({ result: 'called' });
    } finally {
      await receiver.close();
    }
  });
});
