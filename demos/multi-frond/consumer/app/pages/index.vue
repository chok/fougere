<template>
  <div style="max-width: 700px; margin: 3rem auto; font-family: system-ui; line-height: 1.6;">
    <h1>Multi-frond demo</h1>
    <p>Local frond <code>@fronds/catalog</code> + remote frond <code>@fronds/blog</code> (synced).</p>
    <p>Both use the same <code>import</code>, same validation, same Standard Schema v1.</p>
    <ul>
      <li><NuxtLink to="/catalog/products">Products (local frond)</NuxtLink></li>
      <li><NuxtLink to="/blog/posts">Posts (remote frond)</NuxtLink></li>
    </ul>
  </div>
</template>
