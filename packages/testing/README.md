# @fougere/testing

Tests derived from the declaration, and a gradient the test file never states.

```bash
pnpm add -D @fougere/testing
```

```ts
// vitest.config.ts — the whole file
import { fougereTest } from '@fougere/testing/vitest';
export default fougereTest();
```

```ts
// tests/contracts.test.ts — the whole file, and it produces one test per branch
import { testApp, checkContract, checkOutput, checkDoors } from '@fougere/testing';
import Product from '../fronds/catalog/entities/Product.js';

const app = await testApp();

checkContract(app, Product);   // every refusal the judge can state
checkOutput(app, Product);     // no writeOnly field leaves
checkDoors(app, Product);      // local · REST · GraphQL · RPC answer the same
```

`checkDoorContract(app, Product, cases)` runs handler-specific invocation cases through
the same four-door harness. It is useful when the handler must observe a distinction such
as omitted (`undefined`) versus explicitly supplied `null`.

`testApp()` takes no argument: a file under `fronds/catalog/tests/` says its subject is
`catalog`, the way `entities/` already says what a directory holds.

Full documentation: **[Testing](https://fougere.dev/docs/infra/testing)** ·
a worked example: `demos/test-gradient`.

## What it does not do

A test derived from `Post` can never say that `Post` is wrong — it proves the realizations
agree. What must break when the declaration moves is `fougere migrate`. And business
intent is always written by hand.

MIT
