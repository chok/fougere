/**
 * Six invariants this repo states in prose and nothing checked. Each is a REACHABILITY
 * question — what a file ends up pulling, not what it names — which is why no grep
 * replaces this, and why every comment below says "reaches".
 *
 * NO cycle rule, and the reason is the same one that keeps `vue-tsc` out: the root runs
 * TS 7, dependency-cruiser supports `<7`, and without the compiler it cannot tell an
 * `import type` from a runtime import. Measured 2026-08-22 — 30 module-level cycles, and
 * the three read by hand are pairs of `import type` that TypeScript erases. Zero cycles
 * at PACKAGE level, measured the same day. Revisit when it runs on TS 7.
 */
module.exports = {
  forbidden: [
    {
      name: 'browser-surface-reaches-a-host',
      comment:
        "`@fougere/core/contract` is the surface a browser loads. Reaching a node builtin " +
        'or the TypeScript compiler puts 23 MB and a host API behind an import a page makes.',
      severity: 'error',
      from: { path: '^packages/core/src/contract\\.ts$' },
      to: { dependencyTypes: ['core'], pathNot: '^node:test$' },
    },
    {
      name: 'browser-surface-reaches-typescript',
      comment:
        'The scan needs the compiler; the contract does not. Measured 2026-08-22: the ' +
        'closure of `scan/handler-parser.ts` pulls it, and nothing joins the two.',
      severity: 'error',
      from: { path: '^packages/core/src/contract\\.ts$' },
      to: { path: '[/\\\\]typescript[/\\\\]' },
    },
    {
      name: 'faker-outside-testing',
      comment:
        'A 426 KB generator belongs to the package that fabricates values, never to one a ' +
        'browser loads. Deriving CASES reads the axes; fabricating one needs the faker.',
      severity: 'error',
      from: { pathNot: '^packages/testing/' },
      to: { path: 'json-schema-faker|@faker-js' },
    },
    {
      name: 'container-depends-on-something',
      comment: '`@fougere/container` is type-based DI with zero dependencies. Measured: it imports nothing at all.',
      severity: 'error',
      from: { path: '^packages/container/src/' },
      to: { pathNot: '^packages/container/src/' },
    },
    {
      name: 'core-reaches-observability',
      comment:
        'Core holds none of it: a span per op is filled by `@fougere/observability` and read ' +
        'by a panel, and neither imports the other. Today only three comments name it.',
      severity: 'error',
      from: { path: '^packages/core/src/' },
      to: { path: '^packages/observability/' },
    },
    {
      name: 'schema-reaches-a-fougere-package',
      comment: '`@fougere/schema` is the root of the tree — everything derives from it and it derives from nothing.',
      severity: 'error',
      from: { path: '^packages/schema/src/' },
      to: { path: '^packages/(?!schema/)' },
    },
  ],
  options: {
    tsPreCompilationDeps: true,
    // A cross-package edge resolves through `exports`, so it lands on the NEIGHBOUR'S
    // `dist/` — 441 of the 762 modules cruised. That is what makes the two package-level
    // rules below work, and it is why this needs a build before it runs.
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(/tests?/|/templates/|\\.test\\.ts$|/demo/)' },
    tsConfig: { fileName: 'tsconfig.base.json' },
  },
};
