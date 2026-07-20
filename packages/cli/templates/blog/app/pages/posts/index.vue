<script setup lang="ts">
import Post from '@frond/blog/entities/Post';

interface Card { id: string; title: string; status: string }
const { items: posts, loading, error } = await useQuery<Card>(Post, 'published');
</script>

<template>
  <main class="wrap">
    <p><NuxtLink to="/">← home</NuxtLink></p>
    <h1>Published posts</h1>
    <p v-if="loading" class="muted">Loading…</p>
    <p v-else-if="error" class="err">{{ error.message }}</p>
    <p v-else-if="!posts.length" class="muted">
      Nothing published yet. <NuxtLink to="/posts/manage">Publish a draft →</NuxtLink>
    </p>
    <ul v-else>
      <li v-for="p in posts" :key="p.id">{{ p.title }}</li>
    </ul>
  </main>
</template>
