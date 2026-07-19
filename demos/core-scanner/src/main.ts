import { createApp } from '@fougere/core';
import { createContainer } from '@fougere/container-fougere';
import { join } from 'node:path';
import type { Container } from '@fougere/container';

const app = await createApp({
  root: join(import.meta.dirname, '..'),
  createContainer,
});

console.log('=== Fronds discovered ===');
for (const frond of app.fronds) {
  const providers = frond.providers.map((p) => `${p.name} (${p.kind})`);
  console.log(`  ${frond.name}: ${providers.join(', ')}`);
}

console.log('\n=== Resolve from frond scopes ===');

const ordersScope = app.resolve<Container>('frond:orders');
const orderService = ordersScope.resolve<{ listOrders(): unknown[] }>('OrderService');
console.log('\nOrders:', orderService.listOrders());

const catalogScope = app.resolve<Container>('frond:catalog');
const productService = catalogScope.resolve<{ listProducts(): unknown[] }>('ProductService');
console.log('\nProducts:', productService.listProducts());

await app.dispose();
console.log('\n✓ Done');
