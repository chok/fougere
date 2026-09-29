<script lang="ts">
  import { onDestroy } from 'svelte';
  import { summaryOf, cellOf, useCommand, useFormFor, useQuery } from '@fougere/svelte';
  import { post } from '@fronds/facade';
  import Post from '@fronds/__frond__/entities/Post';

  const posts = useQuery(post, 'list');
  const publish = useCommand(post, 'publish');
  const remove = useCommand(post, 'delete');
  const summary = summaryOf(Post, 'post');
  const { fields, values, errors, choices, searchable, search, submit } = useFormFor(Post);
  onDestroy(() => posts.dispose());
</script>

<main class="posts">
  <h1>Posts</h1>
  <form novalidate onsubmit={(event) => { event.preventDefault(); submit(); }}>
    {#each fields as field (field.name)}
      {#if field.control === 'reference'}
        {#if $searchable[field.name]}<input type="search" placeholder={`Search ${field.label}`} oninput={(event) => search(field.name, event.currentTarget.value)} />{/if}
        <select bind:value={$values[field.name]} {...field.attrs}>
          <option value="" disabled>{field.label}</option>
          {#each $choices[field.name] ?? [] as choice (choice.value)}<option value={choice.value}>{choice.label}</option>{/each}
        </select>
      {:else if field.control === 'select'}
        <select bind:value={$values[field.name]} {...field.attrs}>
          {#each field.options ?? [] as option (option)}<option value={option}>{option}</option>{/each}
        </select>
      {:else if field.control === 'boolean'}
        <label><input type="checkbox" checked={Boolean($values[field.name])} onchange={(event) => values.update((current) => ({ ...current, [field.name]: event.currentTarget.checked }))} /> {field.label}</label>
      {:else if field.control === 'text' && !field.attrs?.maxLength}
        <textarea bind:value={$values[field.name]} {...field.attrs} placeholder={field.label}></textarea>
      {:else}
        <input bind:value={$values[field.name]} {...field.attrs} placeholder={field.label} />
      {/if}
      {#if $errors[field.name]}<small>{$errors[field.name]}</small>{/if}
    {/each}
    <button>Create draft</button>
  </form>
  <ul>
    {#each $posts.items as row (row.id)}
      <li>
        {#if summary.name}<strong>{cellOf(summary.name, row)}</strong>{/if}
        {#each summary.facts as fact (fact.name)}{#if cellOf(fact, row)}<span>{cellOf(fact, row)}</span>{/if}{/each}
        {#if row.status === 'draft'}
          <button onclick={() => publish.execute({ params: { id: row.id } })}>Publish</button>
        {/if}
        <button class="delete" onclick={() => remove.execute({ params: { id: row.id } })}>Delete</button>
      </li>
    {/each}
  </ul>
  {#each [$publish, $remove] as command}
    {#if command.error}<p class="refused">{command.error.message}</p>{/if}
  {/each}
</main>

<style>
:global(:root) {
  color-scheme: light dark;
  --ink: #25372d; --muted: #65736a; --line: #dce3d9; --green: #38714c; --wash: #eaf0e6; --bg: #f7f8f4; --paper: #fcfdf9; --refused: #b3261e;
}
@media (prefers-color-scheme: dark) {
    :global(:root) { --ink: #e0e8df; --muted: #9ca99e; --line: #303c32; --green: #9bc99d; --wash: #29392c; --bg: #151c18; --paper: #1b241e; --refused: #f2b8b5; }
}
:global(body) { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.6 system-ui, sans-serif; }
.posts { max-width: 560px; margin: 0 auto; padding: 64px 24px 40px; }
.posts h1 { margin: 0 0 24px; font-size: 20px; font-weight: 600; }
.posts form { display: grid; gap: 8px; padding: 20px; background: var(--paper); border: 1px solid var(--line); border-radius: 12px; }
.posts input, .posts textarea, .posts select { font: inherit; color: inherit; padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--bg); }
.posts textarea { min-height: 90px; resize: vertical; }
.posts small { margin-top: -4px; color: var(--refused); font-size: 12px; }
.posts button { font: inherit; font-weight: 600; cursor: pointer; border: 0; border-radius: 8px; padding: 8px 14px; background: var(--green); color: var(--bg); }
.posts form button { justify-self: start; margin-top: 4px; }
.posts ul { list-style: none; margin: 24px 0 0; padding: 0; }
.posts li { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 12px 4px; border-bottom: 1px solid var(--line); }
.posts li span { color: var(--muted); font-size: 13px; }
.posts li span:last-of-type { margin-right: auto; }
.posts li button { padding: 4px 10px; font-size: 13px; background: var(--wash); color: var(--green); }
.posts li button.delete { background: transparent; color: var(--muted); }
.posts .refused { margin-top: 16px; color: var(--refused); }
</style>
