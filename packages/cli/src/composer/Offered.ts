/**
 * The hosts the composer offers: the ones run end to end from a fresh workspace — which is what
 * `door:check` does to each of them, reading this list. Every other host stays reachable by `--app`.
 */
export const OFFERED = ['nuxt', 'next', 'react', 'svelte', 'admin'];
