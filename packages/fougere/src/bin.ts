#!/usr/bin/env node
/**
 * `fougere` — the CLI under its unscoped name.
 *
 * It holds nothing. `@fougere/cli` already installs a `fougere` binary; this
 * package exists so that `npx fougere` and `npm i -g fougere` reach it, because
 * an unscoped name is first-come-first-served and a scope does not reserve it.
 *
 * Importing the bin runs it — it is a script, not a module with an entry point,
 * and `argv` travels untouched.
 */
import '@fougere/cli/bin';
