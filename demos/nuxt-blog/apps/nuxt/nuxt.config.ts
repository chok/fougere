export default defineNuxtConfig({
  modules: ["@nuxt/ui", "@fougere/nuxt"],
  // The dev panel, on the CONSUMER side: this app declares `remotes: { blog }`, so its
  // calls to the blog leave the process — the half a browser's devtools cannot show.
  // The blog's own process serves another on :4400 (see serve-blog.mjs).
  // `observability` first: it opens the span whose id every call carries across the wire,
  // which is what lets the two panels show the same trace on both sides. No `otlp:` — the
  // trace exists without a collector, nothing leaves the process.
  fougere: {
    observability: { service: 'nuxt-blog' },
    calls: { panel: 4402 },
  },
  css: ["~/assets/css/main.css"],
  compatibilityDate: "2026-03-26",
});
