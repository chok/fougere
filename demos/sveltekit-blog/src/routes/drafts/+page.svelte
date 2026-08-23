<script lang="ts">
	import { onDestroy } from 'svelte';
	import { useQuery, useCommand } from '@fougere/svelte';
	import Post from '../../../fronds/blog/entities/Post';

	const drafts = useQuery<Post>(Post, 'listDrafts');
	const publish = useCommand(Post, 'publish');

	// The link needs to forget this read when the page goes. React does it in an
	// effect's teardown, Vue in `onScopeDispose`; Svelte says so out loud.
	onDestroy(() => drafts.dispose());
</script>

<main>
	<h1>Drafts</h1>
	{#if $drafts.loading}<p>Loading…</p>{/if}
	{#if $drafts.error}<p style="color:#b00">{$drafts.error.message}</p>{/if}
	{#if !$drafts.loading && $drafts.items.length === 0}<p>No drafts left — everything is published.</p>{/if}

	{#each $drafts.items as post (post.id)}
		<article style="display:flex;align-items:center;gap:1rem;border-bottom:1px solid #f0f0f0;padding:.75rem 0">
			<div style="flex:1">
				<h2 style="font-size:1.05rem;margin:0">{post.title}</h2>
				<small style="color:#999">{post.status}</small>
			</div>
			<button type="button" disabled={$publish.loading} onclick={() => publish.execute({ params: { id: post.id } })}>
				Publish
			</button>
		</article>
	{/each}

	{#if $publish.error}<p style="color:#b00">{$publish.error.message}</p>{/if}
	<button type="button" onclick={() => drafts.refresh()} style="margin-top:1rem">Refresh</button>
</main>
