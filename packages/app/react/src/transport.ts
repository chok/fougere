'use client';
/**
 * Kept as a re-export: the fetcher and the revalidation bus started here, and moving
 * them into `@fougere/app/client` is what a second non-Nuxt client revealed — none
 * of it was React. This file is the seam that used to hide that.
 */
export { fetcher, onRefetch, revalidate, CALL_ENDPOINT } from '@fougere/app/client';
