/**
 * What this app hosts: nothing of its own.
 *
 * `remotes:` in `fougere.config.ts` points `catalog` at a Worker, so every row this app
 * shows lives behind a call. Stating that emptiness is what keeps the boot from scanning
 * a disk the edge does not have — and `typescript`, which it could not carry, never loads.
 *
 * The file is the statement. An app with fronds of its own lists them here.
 */
export default [];
