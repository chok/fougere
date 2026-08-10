<script lang="ts">
	let { children } = $props();
</script>

<div style="font-family:ui-sans-serif,system-ui,sans-serif;margin:0 auto;max-width:720px;padding:2rem 1rem;line-height:1.55">
	<header style="display:flex;gap:1rem;border-bottom:1px solid #e5e5e5;padding-bottom:1rem;margin-bottom:2rem">
		<strong>fougere · sveltekit</strong>
		<nav style="display:flex;gap:1rem;margin-left:auto">
			<a href="/">Published</a>
			<a href="/drafts">Drafts</a>
			<a href="/new">New</a>
		</nav>
	</header>
	{@render children()}
</div>
