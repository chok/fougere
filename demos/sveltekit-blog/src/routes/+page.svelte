<script lang="ts">
	import { useQuery } from '@fougere/svelte';
	import Post from '../../fronds/blog/entities/Post';

	// A store, so `$posts` auto-subscribes. Same designation as every other host:
	// the imported class and a verb.
	const posts = useQuery<Post>(Post, 'list');
</script>

<main>
	<h1>Published</h1>
	{#if $posts.loading}<p>Loading…</p>{/if}
	{#if $posts.error}<p style="color:#b00">{$posts.error.message}</p>{/if}
	{#if !$posts.loading && $posts.items.length === 0}<p>Nothing published yet.</p>{/if}

	{#each $posts.items as post (post.id)}
		<article style="border-bottom:1px solid #f0f0f0;padding:.75rem 0">
			<h2 style="font-size:1.05rem;margin:0">{post.title}</h2>
			<p style="margin:.25rem 0;color:#555">{post.body}</p>
			<small style="color:#999">{post.status}</small>
		</article>
	{/each}
</main>
