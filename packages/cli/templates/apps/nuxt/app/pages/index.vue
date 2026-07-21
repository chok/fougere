<template>
  <main class="wrap">
    <h1>🌿 {{ /* app */ '' }}Fougère</h1>
    <p>App running. Your workspace fronds are scanned — their entities back the DB and the call API.</p>
    <p class="muted">
      Write pages in <code>app/pages/</code> that consume a frond, e.g.
      <code>const { items } = await useQuery(Post, 'published')</code> with
      <code>import Post from '@frond/&lt;name&gt;/entities/Post'</code>.
    </p>
  </main>
</template>
