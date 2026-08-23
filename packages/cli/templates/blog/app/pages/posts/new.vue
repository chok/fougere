<script setup lang="ts">
import Post from '@fronds/blog/entities/Post';

const { values, errors, submit, loading, error } = useFormFor(Post);

async function onSubmit() {
  if (await submit()) navigateTo('/posts/manage');
}
</script>

<template>
  <main class="wrap">
    <p><NuxtLink to="/posts/manage">← drafts</NuxtLink></p>
    <h1>New draft</h1>
    <p class="muted">
      Created as a <span class="badge">draft</span>. You own the title and body —
      <code>status</code> is the server's.
    </p>
    <form @submit.prevent="onSubmit">
      <label>Title</label>
      <input v-model="values.title" placeholder="Post title" autofocus />
      <p v-if="errors.title" class="err">{{ errors.title }}</p>

      <label>Body</label>
      <textarea v-model="values.body" rows="8" placeholder="Write your post…"></textarea>
      <p v-if="errors.body" class="err">{{ errors.body }}</p>

      <p v-if="error" class="err">{{ error.message }}</p>
      <p style="margin-top: 1rem">
        <button type="submit" :disabled="loading">Create draft</button>
      </p>
    </form>
  </main>
</template>
