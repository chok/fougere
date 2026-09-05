<script setup lang="ts">
/**
 * The whole demo, on one page.
 *
 * `Product` is imported from the frond next door — the SAME class that builds the D1
 * table in the other Worker and validates a write there. Nothing is serialized to get it
 * here; it is the declaration, read twice.
 *
 * `useQuery(Product, 'list')` names an entity and a verb, never an address. Which
 * process answers is `remotes:` in fougere.config.ts, and nothing on this page knows.
 */
import Product from '../../../fronds/catalog/entities/Product';

const { items: products, loading, error, refresh } = useQuery(Product, 'list');

// The validator is the entity's, so the form refuses here exactly as the Worker would.
const Draft = Product.omit('id');
const form = reactive({ name: '', sku: '', cents: 0, listed: true });
const errors = ref<{ path: string; message: string }[]>([]);
const create = useCommand(Product, 'create');

async function submit() {
  const validated = Draft.validate(form);
  if (!validated.success) {
    errors.value = validated.errors;
    return;
  }
  errors.value = [];
  await create({ ...validated.data, id: crypto.randomUUID() });
  await refresh();
}
</script>

<template>
  <main>
    <h1>Catalog</h1>
    <p class="sub">
      This page hosts nothing. Every row below came from another Worker, named
      <code>catalog</code> in <code>fougere.config.ts</code> and nowhere else.
    </p>

    <p v-if="loading">loading…</p>
    <p v-else-if="error" class="err">{{ error.message }}</p>
    <ul v-else>
      <li v-for="p in products" :key="p.id">
        <strong>{{ p.name }}</strong> · <code>{{ p.sku }}</code> ·
        {{ (p.cents / 100).toFixed(2) }} € · {{ p.listed ? 'listed' : 'hidden' }}
      </li>
    </ul>

    <form @submit.prevent="submit">
      <input v-model="form.name" placeholder="name" >
      <input v-model="form.sku" placeholder="sku" >
      <input v-model.number="form.cents" type="number" placeholder="cents" >
      <button type="submit">add</button>
    </form>
    <ul v-if="errors.length" class="err">
      <li v-for="e in errors" :key="e.path">{{ e.path }} — {{ e.message }}</li>
    </ul>
  </main>
</template>

<style>
body { font: 16px/1.6 ui-sans-serif, system-ui; margin: 0; }
main { max-width: 44rem; margin: 4rem auto; padding: 0 1.5rem; }
code { background: #f4f4f5; padding: .1em .35em; border-radius: .25em; }
.sub { color: #52525b; }
.err { color: #b91c1c; }
form { display: flex; gap: .5rem; margin-top: 2rem; flex-wrap: wrap; }
input, button { font: inherit; padding: .4em .6em; border: 1px solid #d4d4d8; border-radius: .3em; }
@media (prefers-color-scheme: dark) {
  body { background: #111; color: #eee; }
  code { background: #27272a; }
  .sub { color: #a1a1aa; }
  input, button { background: #18181b; color: #eee; border-color: #3f3f46; }
}
</style>
