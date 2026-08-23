/**
 * The control: the same answer, written by hand.
 *
 * Same D1 database, same rows, same two rules the entity declares (`name` between 1 and
 * 200, `sku` between 3 and 32, `cents` at least 0, no unknown key). It exists so the
 * Fougere worker's CPU time has something to be a ratio OF — the role
 * `node-http-validated` plays in the throughput bench next door.
 *
 * Deliberately not tidy: this is what the framework replaces, so hiding the work in
 * helpers would flatter the comparison.
 */
import { env } from 'cloudflare:workers';

interface Env { DB: D1Database }
const db = (env as unknown as Env).DB;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const FIELDS = ['id', 'name', 'sku', 'cents', 'listed'];

function judge(body: Record<string, unknown>): string[] {
  const errors: string[] = [];
  for (const key of Object.keys(body)) if (!FIELDS.includes(key)) errors.push(`${key}: Unknown field`);
  const { id, name, sku, cents, listed } = body;
  if (typeof id !== 'string' || id.length < 1) errors.push('id: Required');
  if (typeof name !== 'string') errors.push('name: Required');
  else if (name.length < 1 || name.length > 200) errors.push('name: String out of bounds');
  if (typeof sku !== 'string') errors.push('sku: Required');
  else if (sku.length < 3 || sku.length > 32) errors.push('sku: String out of bounds');
  if (typeof cents !== 'number') errors.push('cents: Required');
  else if (cents < 0) errors.push('cents: below minimum');
  if (typeof listed !== 'boolean') errors.push('listed: Required');
  return errors;
}

const row = (r: Record<string, unknown>) => ({ ...r, listed: Boolean(r.listed) });

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/api/products') {
      const { results } = await db.prepare('select * from products').all();
      return json(results.map(row));
    }

    if (request.method === 'GET' && url.pathname.startsWith('/api/products/')) {
      const found = await db.prepare('select * from products where id = ?')
        .bind(url.pathname.split('/').pop()).first();
      return found ? json(row(found as Record<string, unknown>)) : json({ code: 'NOT_FOUND' }, 404);
    }

    if (request.method === 'POST' && url.pathname === '/api/products') {
      const body = (await request.json()) as Record<string, unknown>;
      const errors = judge(body);
      if (errors.length > 0) return json({ code: 'VALIDATION_FAILED', message: errors.join(', ') }, 400);
      await db.prepare('insert into products values (?, ?, ?, ?, ?)')
        .bind(body.id, body.name, body.sku, body.cents, body.listed ? 1 : 0).run();
      return json(body);
    }

    return json({ code: 'NOT_FOUND' }, 404);
  },
};
