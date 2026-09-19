/**
 * CRAN 4 — l'app, avec des pages.
 *
 * Le formulaire n'est écrit nulle part : `formFieldsOf` le dérive de `Product`, avec ses
 * contraintes sous les noms que le navigateur connaît déjà (`minlength`, `max`, `required`).
 * La page n'énonce donc aucune règle de son côté — c'est le sens de « juge local = juge
 * distant », et c'est le seul cran où on peut le voir plutôt que le plaider.
 *
 *   pnpm dev     puis http://127.0.0.1:4300
 */
import { createServer } from 'node:http';
import { createLocalRunner, type Page } from '@fougere/core';
import { Invocation } from '@fougere/core/contract';
import { formFieldsOf, payloadOf, serveRpc } from '@fougere/app';
import { testApp } from '@fougere/testing';
import Product from './fronds/catalog/entities/Product.js';

const app = await testApp({ root: import.meta.dirname });
const run = createLocalRunner(app);
const port = Number(process.env.PORT ?? 4300);

const escape = (value: unknown) =>
  String(value).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** One input per declared field, and nothing this page decided on its own. */
function inputFor(field: ReturnType<typeof formFieldsOf>[number]): string {
  const attrs = Object.entries(field.attrs ?? {})
    .map(([name, value]) => `${name}="${escape(value)}"`).join(' ');
  const label = `<label for="${field.name}">${escape(field.label)}</label>`;

  if (field.control === 'select') {
    const options = (field.options ?? []).map((one) => `<option value="${escape(one)}">${escape(one)}</option>`).join('');

    return `${label}<select id="${field.name}" name="${field.name}" ${attrs}>${options}</select>`;
  }
  // `attrs` porte déjà `type` quand la forme le décide : ne pas le réécrire, sinon la
  // balise en a deux et c'est la page qui a tranché.
  const type = 'type' in (field.attrs ?? {}) ? ''
    : ` type="${field.control === 'boolean' ? 'checkbox' : field.control}"`;

  return `${label}<input id="${field.name}" name="${field.name}"${type} ${attrs}>`;
}

async function page(): Promise<string> {
  const { items } = await run({ entity: 'product', op: 'list' }, Invocation.empty) as Page<Product>;
  const fields = formFieldsOf(Product, 'product');

  return `<!doctype html><meta charset="utf-8"><title>test-gradient</title>
<h1>Catalogue</h1>
<ul id="products">${items.map((row) => `<li data-sku="${escape(row.sku)}">${escape(row.name)}</li>`).join('')}</ul>
<form id="new-product">${fields.map(inputFor).join('')}<button type="submit">Ajouter</button></form>
<p id="error" hidden></p>
<script type="module">
const form = document.querySelector('#new-product');
const error = document.querySelector('#error');
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  error.hidden = true;
  // Le texte du formulaire, tel quel : c'est le serveur, comme useFormFor, qui le lit selon
  // la forme de Product. La page ne nomme aucun champ.
  const response = await fetch('/form/product', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(Object.fromEntries(new FormData(form))),
  });
  const answer = await response.json();
  if (answer.error) { error.textContent = answer.error.message; error.hidden = false; return; }
  location.reload();
});
</script>`;
}

async function bodyOf(request: AsyncIterable<unknown>): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);

  return JSON.parse(Buffer.concat(chunks).toString());
}

createServer(async (request, response) => {
  if (request.url === '/' ) {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(await page());

    return;
  }
  if (request.method === 'POST' && request.url === '/_fougere/call') {
    const answer = await serveRpc(app, { path: '', body: await bodyOf(request), state: {} });
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(answer));

    return;
  }
  // Ce que fait useFormFor dans un hôte : le texte d'un formulaire, lu selon la forme de
  // l'entité, puis la même porte. `/_fougere/call` reste strict pour un client JSON.
  if (request.method === 'POST' && request.url === '/form/product') {
    const input = payloadOf(Product, await bodyOf(request) as Record<string, unknown>);
    const answer = await serveRpc(app, { path: '', body: { jsonrpc: '2.0', id: 1, method: 'product.create',
      params: { params: {}, query: {}, input, state: {} } }, state: {} });
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(answer));

    return;
  }
  response.writeHead(404).end();
}).listen(port, '127.0.0.1', () => console.log(`http://127.0.0.1:${port}`));
