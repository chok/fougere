<script setup lang="ts">
/**
 * Posts page — remote frond @fronds/blog (synced via `fougere sync`)
 *
 * Same import pattern as a local frond.
 * The Entity was generated from remote metadata at build time.
 * Validation, pick/omit, Standard Schema v1 — all identical.
 */
import Post from '@fronds/blog/entities/Post';

const CreatePost = Post.omit('id', 'createdAt');

const form = reactive({ title: '', body: '', views: 0 });
const errors = ref<{ path: string; message: string }[]>([]);
const created = ref<Record<string, unknown>[]>([]);

function validate() {
  const result = CreatePost.validate(form);
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
  // In a real app: fetch('http://remote-blog:4001/api/posts', { method: 'POST', body: JSON.stringify(data) })
  created.value.push({ ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() });
  form.title = '';
  form.body = '';
  form.views = 0;
}

function fieldError(field: string) {
  return errors.value.find((e) => e.path === field)?.message;
}
</script>

<template>
  <div style="max-width: 600px; margin: 3rem auto; font-family: system-ui;">
    <h1>Posts <small style="color: #888;">(remote @fronds/blog, synced)</small></h1>
    <p><NuxtLink to="/">Back</NuxtLink></p>

    <form @submit.prevent="submit" style="display: flex; flex-direction: column; gap: 0.5rem; margin: 1rem 0;">
      <div>
        <label>Title</label><br>
        <input v-model="form.title" placeholder="My post title" style="padding: 0.4rem; width: 100%;">
        <div v-if="fieldError('title')" style="color: red; font-size: 0.85rem;">{{ fieldError('title') }}</div>
      </div>
      <div>
        <label>Body</label><br>
        <textarea v-model="form.body" rows="4" placeholder="Post content..." style="padding: 0.4rem; width: 100%;"></textarea>
        <div v-if="fieldError('body')" style="color: red; font-size: 0.85rem;">{{ fieldError('body') }}</div>
      </div>
      <div>
        <label>Views</label><br>
        <input v-model.number="form.views" type="number" style="padding: 0.4rem; width: 100%;">
        <div v-if="fieldError('views')" style="color: red; font-size: 0.85rem;">{{ fieldError('views') }}</div>
      </div>
      <button type="submit" style="padding: 0.5rem; cursor: pointer;">Create Post</button>
    </form>

    <div v-if="created.length > 0">
      <h2>Created ({{ created.length }})</h2>
      <pre v-for="p in created" :key="(p.id as string)" style="background: #f5f5f5; padding: 0.5rem; margin: 0.25rem 0;">{{ JSON.stringify(p, null, 2) }}</pre>
    </div>
  </div>
</template>
