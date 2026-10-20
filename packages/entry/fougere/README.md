# fougere

> The Fougere CLI, under its unscoped name

```bash
npx fougere new shop          # compose a workspace, written for the package manager that ran it
npx fougere dev blog          # run one frond in its own process, from its sources
npx fougere build             # the project as JavaScript — then `fougere serve blog` starts it
npx fougere call Post.list    # call an operation
npx fougere check             # read the model, report what a split would break
```

`pnpm dlx`, `bunx` and `yarn dlx` run it the same way.

Same binary as [`@fougere/cli`](https://www.npmjs.com/package/@fougere/cli) — this
package holds no code, only the name. Install either one.

**[Documentation →](https://fougere.dev/)**
