<template>
  <NuxtPage />
</template>

<style>
:root { --fg: #1a1a1a; --muted: #6b7280; --border: #e5e7eb; --accent: #2563eb; }
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, -apple-system, sans-serif; color: var(--fg); line-height: 1.6; }
.wrap { max-width: 720px; margin: 3rem auto; padding: 0 1.5rem; }
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
h1 { font-size: 1.6rem; margin-bottom: 0.25rem; }
code { background: #f3f4f6; padding: 0.1rem 0.35rem; border-radius: 4px; font-size: 0.9em; }
table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
th, td { text-align: left; padding: 0.6rem 0.5rem; border-bottom: 1px solid var(--border); }
th { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.03em; color: var(--muted); }
label { display: block; font-size: 0.85rem; margin: 0.9rem 0 0.3rem; color: var(--muted); }
input, textarea { width: 100%; padding: 0.5rem 0.6rem; border: 1px solid var(--border); border-radius: 6px; font: inherit; }
button { padding: 0.5rem 0.9rem; border: 0; border-radius: 6px; background: var(--accent); color: #fff; font: inherit; cursor: pointer; }
button:disabled { opacity: 0.5; cursor: default; }
.badge { font-size: 0.72rem; padding: 0.15rem 0.55rem; border-radius: 999px; background: #f3f4f6; color: var(--muted); }
.badge.published { background: #dcfce7; color: #166534; }
.muted { color: var(--muted); }
.err { color: #b91c1c; font-size: 0.9rem; }
</style>
