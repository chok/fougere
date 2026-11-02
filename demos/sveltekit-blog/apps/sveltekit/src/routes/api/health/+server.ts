/** The app's own route, under the prefix the REST facade also claims. It still answers. */
export const GET = () => Response.json({ ok: true, from: 'the app, not fougere' });
