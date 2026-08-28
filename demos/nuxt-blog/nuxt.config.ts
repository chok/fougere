export default defineNuxtConfig({
  modules: ["@nuxt/ui", "@fougere/nuxt"],
  // The dev panel, on the CONSUMER side: this app declares `remotes: { blog }`, so its
  // calls to the blog leave the process — the half a browser's devtools cannot show.
  // The blog's own process serves another on :4400 (see serve-blog.mjs).
  fougere: { calls: { panel: 4402 } },
  css: ["~/assets/css/main.css"],
  compatibilityDate: "2026-03-26",
});
