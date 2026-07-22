<script setup lang="ts">
// The blog frond lives at the workspace root. Its Post entity IS the metadata
// every primitive reads — imported as a class, nothing serialized to the client.
import Post from '@frond/blog/entities/Post';

type Row = { id: string; title: string; status: 'draft' | 'published' };

// READ — every post with its status. Any command on Post (below) revalidates
// this on its own: the same entity is designated on both sides, nothing to wire.
const { items: posts, loading } = await useQuery<Row>(Post, 'list');

// WRITE · create — the form contract, not a widget. It judges locally with the
// SAME rules the handler enforces (one schema, both sides), then rides a command.
// On success the list above refreshes by itself. A post is born a draft.
const { values, errors, submit, loading: creating, error: createError } = useFormFor(Post);
async function create() {
  if (await submit()) { values.title = ''; values.body = ''; }
}

// WRITE · publish — draft → published is an operation, not a field you set.
const { execute, loading: publishing, error: publishError } = useCommand(Post, 'publish');
const publishPost = (id: string) => execute({ params: { id } });
</script>

<template>
  <main class="wrap">
    <h1>🌿 Blog</h1>
    <p class="muted">
      Create a draft, then publish it — the list updates itself. The form, the
      list, and the Publish button are three Fougère primitives against one entity.
    </p>

    <form @submit.prevent="create">
      <label for="title">Title</label>
      <input id="title" v-model="values.title" placeholder="Post title" />
      <p v-if="errors.title" class="err">{{ errors.title }}</p>

      <label for="body">Body</label>
      <textarea id="body" v-model="values.body" rows="4" placeholder="Write something…" />
      <p v-if="errors.body" class="err">{{ errors.body }}</p>

      <p v-if="createError" class="err">{{ createError.message }}</p>
      <button type="submit" :disabled="creating" style="margin-top: 0.9rem">
        {{ creating ? 'Creating…' : 'Create draft' }}
      </button>
    </form>

    <p v-if="publishError" class="err">{{ publishError.message }}</p>
    <p v-if="loading" class="muted">Loading…</p>
    <p v-else-if="!posts.length" class="muted">No posts yet — create one above; it starts as a draft.</p>
    <table v-else>
      <thead>
        <tr><th>Title</th><th>Status</th><th></th></tr>
      </thead>
      <tbody>
        <tr v-for="post in posts" :key="post.id">
          <td>{{ post.title }}</td>
          <td><span class="badge" :class="post.status">{{ post.status }}</span></td>
          <td style="text-align: right">
            <button v-if="post.status === 'draft'" :disabled="publishing" @click="publishPost(post.id)">
              Publish
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </main>
</template>
