<script lang="ts">
  import { onDestroy } from 'svelte';
  import { useCommand, useFormFor, useQuery } from '@fougere/svelte';
  import { post } from '@fronds/facade';
  import Post from '@fronds/__frond__/entities/Post';

  const posts = useQuery(post, 'list');
  const publish = useCommand(post, 'publish');
  const { values, errors, submit } = useFormFor(Post);
  onDestroy(() => posts.dispose());
</script>

<main>
  <h1>Posts</h1>
  <form onsubmit={(event) => { event.preventDefault(); submit(); }}>
    <input bind:value={$values.title} placeholder="Title" />
    {#if $errors.title}<small>{$errors.title}</small>{/if}
    <textarea bind:value={$values.body} placeholder="Body"></textarea>
    {#if $errors.body}<small>{$errors.body}</small>{/if}
    <button>Create draft</button>
  </form>
  <ul>
    {#each $posts.items as row (row.id)}
      <li>
        {row.title} — {row.status}
        {#if row.status === 'draft'}
          <button onclick={() => publish.execute({ params: { id: row.id } }).catch(() => {})}>Publish</button>
        {/if}
      </li>
    {/each}
  </ul>
  {#if $publish.error}<p>{$publish.error.message}</p>{/if}
</main>
