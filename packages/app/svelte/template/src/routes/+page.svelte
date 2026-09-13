<script lang="ts">
  import { onDestroy } from 'svelte';
  import { useQuery } from '@fougere/svelte';
  // Written by the scan: one export per address, carrying the handler that answers there.
  // Replace `post` with a facade your own frond serves.
  import { post } from '@fronds/facade';

  const rows = useQuery(post, 'list');
  onDestroy(() => rows.dispose());
</script>

<main>
  <h1>Fougere</h1>
  {#if $rows.loading}<p>Loading…</p>{/if}
  {#if $rows.error}<p style="color:#b00">{$rows.error.message}</p>{/if}
  {#each $rows.items as row (row.id)}
    <pre>{JSON.stringify(row, null, 2)}</pre>
  {/each}
</main>
