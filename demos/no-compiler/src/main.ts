/**
 * An app whose fronds are written by hand, booted by Node alone.
 *
 * `fronds.ts` names each class. `Crud(Book)` says its five operations and `Presenter(Book)` its
 * computed field, so nothing else needs writing. No scan reads the sources, `@fougere/compiler`
 * is not a dependency, and Node runs the `.ts` files by erasing their types.
 */
import { registerHooks } from 'node:module';
import { join } from 'node:path';

const loaded = new Set<string>();
registerHooks({
  resolve(specifier, context, next) {
    const resolved = next(specifier, context);
    loaded.add(resolved.url);

    return resolved;
  },
});

const { bootApp } = await import('@fougere/defaults');
const { createLocalRunner, Invocation } = await import('@fougere/core');

const app = await bootApp(join(import.meta.dirname, '..'), { migrates: true });
const call = createLocalRunner(app);

console.log('\n1. two books, through the operations Crud(Book) states');
for (const book of [{ title: 'Middlemarch', pages: 880 }, { title: 'Pnin', pages: 191 }]) {
  await call({ address: 'book', op: 'create' }, Invocation.from({ input: book }));
}
const { items } = await call({ address: 'book', op: 'list' }, Invocation.empty) as { items: { title: string; evenings: number }[] };
for (const book of items) console.log(`   ${book.title} — ${book.evenings} evenings, a field BookPresenter computes`);

console.log('\n2. a book the entity refuses, judged at the door');
try {
  await call({ address: 'book', op: 'create' }, Invocation.from({ input: { title: '', pages: 0 } }));
} catch (error) {
  console.log(`   → ${(error as Error).message}`);
}

console.log('\n3. what this process loaded to get here');
const of = (part: string) => [...loaded].filter((url) => url.includes(part)).length;
console.log(`   ${of('/compiler/')} module of @fougere/compiler, ${of('typescript')} of TypeScript`);

await app.dispose();
console.log('');
