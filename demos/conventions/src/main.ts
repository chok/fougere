import { createLocalRunner, Invocation, resolveConventions } from '@fougere/core';
import { loadConfig } from '@fougere/core/node';
import { bootApp } from '@fougere/defaults';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const { dirs, fronds, scope } = resolveConventions((await loadConfig(root)).conventions);

const app = await bootApp(root, { migrates: true });
const call = createLocalRunner(app);
const place = (productId: string) => call({ address: 'order', op: 'place' }, Invocation.from({ params: { productId } }));
const addProduct = (input: object) => call({ address: 'product', op: 'create' }, Invocation.from({ input }));

console.log(`scope       ${scope}             order.place reached catalog through it: Fern for ${(await place('fern') as { cents: number }).cents}`);
console.log(`fronds      ${fronds}/           answering ${app.fronds.servedNames().join(', ')}`);
console.log(`entities    ${dirs.entities}/            ${app.fronds.entityNames().join(', ')}`);
console.log(`handlers    ${dirs.handlers}/         order.place answered`);
console.log(`seeds       ${dirs.seeds}/          fern and moss were there before the first call`);
console.log(`services    ${dirs.services}/         Till was injected into OrderHandler`);
console.log(`rules       ${dirs.rules}/             1000 became 1200 with its tax`);
console.log(`vocabulary  ${dirs.vocabulary}/             sku '${await addProduct({ sku: 'nope', title: 'x', cents: 1 }).catch((refusal: Error) => refusal.message)}'`);
console.log(`extensions  ${dirs.extensions}/           see the line above the table`);
console.log(`versions    ${dirs.versions}/           ${existsSync(join(root, fronds, 'orders', dirs.versions, 'v1', 'shape.json')) ? 'v1 recorded by `fougere freeze`' : 'nothing frozen'}`);

await app.dispose();
