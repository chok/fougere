# Working in this application

This project is built with **Fougere**. Read `CLAUDE.md` for the model and architecture guidance
that applies to every coding agent.

## Required verification workflow

After every change to handlers, entities, Fronds, configuration, or topology:

1. Run `fougere check`.
2. Fix every deterministic error it reports before continuing.
3. Run the relevant tests, then run `pnpm typecheck`.

`fougere check` is the Fougere model barrier; tests and TypeScript come after it passes.
