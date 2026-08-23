<script setup lang="ts">
/**
 * Products page — local frond @fronds/catalog
 *
 * Direct import of the Entity class for client-side validation.
 * Same Entity that drives the DB schema and REST API on the server.
 */
import Product from '@fronds/catalog/entities/Product';

const CreateProduct = Product.omit('id');

const form = reactive({ name: '', price: 0, stock: 0 });
const errors = ref<{ path: string; message: string }[]>([]);
const created = ref<Record<string, unknown>[]>([]);

function validate() {
  const result = CreateProduct.validate(form);
  if (result.success) {
    errors.value = [];
    return result.data;
  }
  errors.value = result.errors;
  return null;
}

async function submit() {
  const data = validate();
  if (!data) return;
  // In a real app: useProductCrud().create(data)
  created.value.push({ ...data, id: crypto.randomUUID() });
  form.name = '';
  form.price = 0;
  form.stock = 0;
}

function fieldError(field: string) {
  return errors.value.find((e) => e.path === field)?.message;
}
</script>

<template>
  <div style="max-width: 600px; margin: 3rem auto; font-family: system-ui;">
    <h1>Products <small style="color: #888;">(local @fronds/catalog)</small></h1>
    <p><NuxtLink to="/">Back</NuxtLink></p>

    <form @submit.prevent="submit" style="display: flex; flex-direction: column; gap: 0.5rem; margin: 1rem 0;">
      <div>
        <label>Name</label><br>
        <input v-model="form.name" placeholder="Widget" style="padding: 0.4rem; width: 100%;">
        <div v-if="fieldError('name')" style="color: red; font-size: 0.85rem;">{{ fieldError('name') }}</div>
      </div>
      <div>
        <label>Price</label><br>
        <input v-model.number="form.price" type="number" step="0.01" style="padding: 0.4rem; width: 100%;">
        <div v-if="fieldError('price')" style="color: red; font-size: 0.85rem;">{{ fieldError('price') }}</div>
      </div>
      <div>
        <label>Stock</label><br>
        <input v-model.number="form.stock" type="number" style="padding: 0.4rem; width: 100%;">
        <div v-if="fieldError('stock')" style="color: red; font-size: 0.85rem;">{{ fieldError('stock') }}</div>
      </div>
      <button type="submit" style="padding: 0.5rem; cursor: pointer;">Create Product</button>
    </form>

    <div v-if="created.length > 0">
      <h2>Created ({{ created.length }})</h2>
      <pre v-for="p in created" :key="(p.id as string)" style="background: #f5f5f5; padding: 0.5rem; margin: 0.25rem 0;">{{ JSON.stringify(p, null, 2) }}</pre>
    </div>
  </div>
</template>
