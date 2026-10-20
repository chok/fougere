---
'@fougere/cli': minor
'create-fougere': minor
'@fougere/nuxt': minor
'@fougere/next': minor
---

`fougere new` writes the project for the package manager that ran it — npm, pnpm, bun or yarn 4 — read
off `npm create`, `pnpx`, `bunx` or `yarn dlx`, then off the project it is created in, asked when nothing
says, `--package-manager` to state it. Its scripts, its workspace file and its build permissions are that
tool's own. The workspace holds the apps alone (`"workspaces": ["apps/*"]`): a frond has no
`package.json`, and no `workspace:*` names one. `@fougere/cli/package-manager` exports what each tool says for a gesture — install, add, run, create —
reading no disk.
