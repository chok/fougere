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
      beside: async (request) => Response.json({ body: request.body === null }),
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
