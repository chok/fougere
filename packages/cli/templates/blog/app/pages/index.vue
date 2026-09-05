<template>
  <main class="wrap">
    <h1>🌿 blog</h1>
    <p>A Fougère frond: one entity (<code>Post</code>), its contracts, and a business operation. Everything below is derived from it.</p>
    <p>
      <NuxtLink to="/posts">Published</NuxtLink> ·
      <NuxtLink to="/posts/manage">Drafts &amp; publishing</NuxtLink> ·
      <NuxtLink to="/posts/new">New draft</NuxtLink>
    </p>
    <p class="muted">The loop: create a draft → it stays private → publish it (a validated operation, not a field write) → it appears in the published list, live.</p>
  </main>
</template>
