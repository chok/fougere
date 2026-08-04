<script setup lang="ts">
// The four primitives are auto-imported by @fougere/nuxt — no import line to write.
// They take an ENTITY, so this page names none: what is composed here is yours, and a
// scaffold that guessed at an entity shipped a page that could not run.
//
//   import Post from '@frond/<your-frond>/entities/Post'
//   const { items, loading } = await useQuery(Post, 'list')
//   const { values, errors, submit } = useFormFor(Post)
//   const { execute } = useCommand(Post, 'publish')
const { user } = useCurrentUser();
</script>

<template>
  <main class="wrap">
    <h1>🌿 Fougere</h1>
    <p class="muted">
      The app boots, the fronds are scanned, the surface is mounted. Write a page against
      one of your entities — the commented block in this file is the whole API.
    </p>
    <p class="muted">Reader: <strong>{{ user?.name ?? 'nobody' }}</strong></p>
    <p class="muted">What to write, and why: <code>CLAUDE.md</code> at the workspace root.</p>
  </main>
</template>

<style>
:root { --fg: #1a1a1a; --muted: #6b7280; }
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, -apple-system, sans-serif; color: var(--fg); line-height: 1.6; }
.wrap { max-width: 720px; margin: 3rem auto; padding: 0 1.5rem; }
h1 { font-size: 1.6rem; margin-bottom: 0.25rem; }
code { background: #f3f4f6; padding: 0.1rem 0.35rem; border-radius: 4px; font-size: 0.9em; }
.muted { color: var(--muted); }
</style>
