<script lang="ts">
	import { goto } from '$app/navigation';
	import { useFormFor } from '@fougere/svelte';
	import Post from '../../../fronds/blog/entities/Post';

	const form = useFormFor(Post);
	const { fields, values, errors, command } = form;
</script>

<main>
	<h1>New post</h1>
	<form
		onsubmit={async (event) => {
			event.preventDefault();
			if (await form.submit()) await goto('/drafts');
		}}
		style="display:grid;gap:1rem;max-width:460px"
	>
		{#each fields as field (field.name)}
			<label style="display:grid;gap:.25rem">
				<span>{field.label}</span>
				<input {...field.attrs} bind:value={$values[field.name]} />
				{#if $errors[field.name]}<small style="color:#b00">{$errors[field.name]}</small>{/if}
			</label>
		{/each}

		<button type="submit" disabled={$command.loading}>
			{$command.loading ? 'Saving…' : 'Create draft'}
		</button>
		{#if $command.error}<p style="color:#b00">{$command.error.message}</p>{/if}
	</form>

	<p style="color:#999;margin-top:2rem">
		The form shows {fields.length} of the entity's six fields. <code>id</code> and
		<code>createdAt</code> are filled by the lifecycle axis, <code>status</code> and
		<code>publishedAt</code> are <code>readOnly</code>.
	</p>
</main>
