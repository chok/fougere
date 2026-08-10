/**
 * An app's own route, deliberately under `/api` — the path the REST projection
 * also claims. Next resolves a static segment before a catch-all, so this file
 * answers and `app/api/[...fougere]/route.ts` never sees the request.
 *
 * That is what "additive" means here: mounting the REST door takes nothing away
 * from the app that mounts it.
 */
export function GET() {
  return Response.json({ ok: true, from: 'the app, not fougere' });
}
