<script setup lang="ts">
import Post from '@fronds/blog/entities/Post';

interface PostValues { id: string; title: string; status: 'draft' | 'published' }
const { items: posts, loading } = await useQuery<PostValues>(Post, 'list');
const publish = useCommand(Post, 'publish');
const failed = ref('');

async function doPublish(id: string) {
  failed.value = '';
  try {
    await publish.execute({ params: { id } });
  } catch (e: any) {
    failed.value = e?.message ?? 'Publish failed';
  }
}
</script>

<template>
  <main class="wrap">
    <p><NuxtLink to="/">← home</NuxtLink></p>
    <h1>Drafts &amp; publishing</h1>
    <p><NuxtLink to="/posts/new">+ New draft</NuxtLink></p>
    <p v-if="failed" class="err">{{ failed }}</p>
    <p v-if="loading" class="muted">Loading…</p>
    <p v-else-if="!posts.length" class="muted">
      No posts yet — <NuxtLink to="/posts/new">create one</NuxtLink>, it starts as a draft.
    </p>
    <table v-else>
      <thead><tr><th>Title</th><th>Status</th><th></th></tr></thead>
      <tbody>
        <tr v-for="p in posts" :key="p.id">
          <td>{{ p.title }}</td>
          <td><span class="badge" :class="{ published: p.status === 'published' }">{{ p.status }}</span></td>
          <td style="text-align: right">
            <button v-if="p.status === 'draft'" :disabled="publish.loading.value" @click="doPublish(p.id)">
              Publish
            </button>
          </td>
        </tr>
      </tbody>
    </table>
    <p class="muted" style="margin-top: 1rem">
      Publishing revalidates the list automatically — the badge flips without a reload.
    </p>
  </main>
</template>
