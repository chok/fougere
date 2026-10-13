export function useAudit() {
  const prompt = auditPrompt(useRuntimeConfig().public.siteUrl);
  const copied = ref(false);

  async function copy() {
    await navigator.clipboard.writeText(prompt);
    copied.value = true;
    setTimeout(() => (copied.value = false), 2000);
  }

  return { prompt, copied, copy };
}

function auditPrompt(origin: string): string {
  return `# Audit: what does a week of work cost here?

You are auditing THIS repository. Be honest: report the costs of
adopting as carefully as the gains, and what would get WORSE as
carefully as what improves. Fougere is added beside what exists,
one module at a time. The question is what the everyday work in
this repo costs today, and what it would cost written that way.

The schema is one subject among several. Most commits in a
backend touch operations, services, wiring and calls to other
systems, not the tables. Weigh every finding by how often that
kind of code actually changes here.

## Reference model — Fougere, a TS framework

One rule: a declaration names nothing outside itself — no table,
no protocol, no host, no address. What it does not name is either
derived from it, or chosen outside it. In practice:

- Shape. One class declares a business object once:

      class Post extends entity({
        id: primary(),
        title: text({ min: 1, max: 160 }),
        status: readOnly(oneOf('draft', 'published',
          { default: 'draft' })),
      }) {}

  Validation (the same in the browser and at the API, unknown
  keys refused), the SQL table, the form contract, the API
  surface, GraphQL types and the TS type all come from it.
- Operations. A handler method is an operation. Its signature is
  its contract: what it takes, what it returns, and the errors it
  can refuse with — found by the scan even when thrown from a
  helper, and published to the client's types.
- Wiring. Nothing is registered by hand. A class in a convention
  folder is found, and constructor parameter types are its
  dependencies. A dependency nothing provides stops the boot,
  naming the class and its file.
- Ports. \`class StripePayment extends Payment\` IS the
  registration. Two implementations stop the boot; one config
  line picks. A retry or a cache is a class that extends the port
  and asks for it, stacked in front by config. Tests get a stub
  derived from the port (\`stubOf(Payment)\`).
- Boundaries. Code lives in fronds (modules). A frond cannot reach
  another frond's rows; it calls its operations or announces a
  fact (\`Emit<T>\`) that others subscribe to by signature. Moving
  a frond to its own process is one config line, with identical
  user code.
- Computed fields. A presenter receives the whole page of rows,
  not one row, so one query per page is the natural form.
- Observability. Every log line says which class wrote it and
  which operation was running. One optional package adds a span
  per operation, its own time apart from its children, and the
  number of SQL queries it ran. An expected refusal and a bug are
  told apart by type, not by convention.
- Reading. \`fougere explain\` and the identity card answer what an
  operation takes, returns, refuses and which modules it reaches.

Scope today (pre-release): storage is additive auto-DDL over
Kysely. SQLite resolves from its name; Postgres, MySQL and SQL
Server work by handing Fougere the Kysely dialect you built. No
search-index projection. Auth via better-auth, or the sessions you
already have behind an auth provider. Price the adoption costs
against THIS scope, not an imagined one.

If you can fetch the web, ground yourself in the docs first:

- ${origin}/docs — the model in one page
- ${origin}/docs/business/handlers — operations
- ${origin}/docs/business/ports — ports and chains
- ${origin}/docs/business/errors — what an operation refuses
- ${origin}/docs/business/presenters — computed fields
- ${origin}/docs/infra/gradient — the process boundary as config
- ${origin}/docs/infra/observability — spans and query counts
- ${origin}/docs/infra/testing — tests and stubs derived
- ${origin}/docs/existing-app — the feature-by-feature path
  (use it to price the adoption cost honestly)

## Rules for every number

- Every sentence carries a unit the reader can recount: a count,
  or a path plus a symbol. Quote the command you ran.
- Where a section finds nothing, write "nothing". It is a result.
- Never claim what Fougere does beyond the model above or a doc
  page you read.
- Never weigh a section by another section's frequency.

## 0. Where the work goes

Run \`git log\` over the last 12 months of the backend and count
the commits that touch each kind of code. Adapt the paths to this
repo and say which you used:

- schema and migrations
- operations: controllers, resolvers, route handlers
- services and business logic
- wiring: module files, DI registration, route tables, barrels
- clients of external systems (HTTP, SDKs, queues)
- tests
- the client side's API calls and generated types

This table is the weight of every section below. A cost paid in
60% of commits and one paid twice a year are not the same size.

## 1. Ports — the systems this code calls

- List every external system the backend calls, with the file of
  its client.
- How many sit behind an abstraction the rest of the code depends
  on, and how many are concrete classes used directly?
- How does a test replace one? Count mock calls, provider
  overrides, fake servers. If tests never replace them, say so.
- Where do retry, cache and timeout live: inside each client, or
  in front of it?

## 2. Wiring — lines that only list things

Count lines whose only job is to register or list what already
exists: module files, provider and export lists, DI tokens, route
tables, path aliases kept in two places. Count names written twice
(declared, then exported). From section 0, how many commits a year
touch these files?

Then: when a dependency is missing, when does this stack say so —
at startup, or at the first call?

## 3. Boundaries — what reaches what

- Build the matrix of imports between top-level domains or
  modules. Report every cycle.
- Does anything refuse a crossing, or does any import pass?
- Pick the module you would most plausibly move to its own
  process. Count the files that would change.
- Count files of business code (not config, not the HTTP layer)
  that name where they run: base URLs, per-service env vars,
  host-specific request objects.

## 4. What an operation refuses

- Count throw sites of expected errors (not found, bad request,
  unauthorized…) by kind.
- Can a caller see them in its types, or does it learn them at
  runtime? Pick three operations and list what each can refuse,
  and how many lines you had to read to find out.
- How is a bug told apart from an expected refusal: by structure,
  or by a convention someone has to remember? Quote the doc or
  helper if there is one.

## 5. Computed fields and reads

- Count fields resolved per row (field resolvers, getters that
  query, serializers that fetch).
- Is there batching? Count hand-made per-request caches.
- Can you tell today how many queries one operation runs?

## 6. Observability

Not "is there tracing" — most stacks auto-instrument HTTP. Ask:

- Can a log line say which operation was running when it was
  written? Count loggers created by hand.
- Are queries counted per operation?
- Is there a hand-kept list (component tags, domain names) that
  copies the folder structure?

## 7. Shape — where the same field is declared again

- Take two business objects: one added in the last year, one the
  app is built around. List every file that re-declares their
  shape: DB, validation, API input and output types, form rules,
  client types.
- Sweep for drift: two declarations of one field that disagree (a
  max length, an enum, a nullable, a default the ORM chose). Quote
  both, and say what breaks between them.
- Files touched per new field (median over at least five commits)
  and per rename. Their frequency comes from section 0.

## 8. Reading by an agent

You are an agent reading this repo, so measure yourself.

- For the three operations of section 4: to know what each takes,
  returns, refuses and which other modules it reaches, how many
  files and lines did you open?
- Count rules in this repo's instruction files (CLAUDE.md,
  AGENTS.md, .cursorrules, CONTRIBUTING) that a person or an agent
  must follow by hand, like "update X when you change Y".
- The other side, stated plainly: this repo's stack is in every
  model's training data, and Fougere is not. An agent writes
  idiomatic code here without reading anything. Say what that is
  worth here.

## Report

Lead with the table from section 0. Then, for each section, its
count and its weight from section 0, side by side.

Then, honestly:
- what this repo ALREADY derives or gets for free — generated
  clients, inferred types, auto-instrumentation, a framework that
  checks wiring at startup. Those are not gains, and a report that
  counts them is lying;
- what would get WORSE: database features in use that Fougere's
  scope does not cover, change-data-capture or search pipelines
  tied to the current ORM, a second migration tool on one
  database, where a Fougere process would be hosted, what the team
  and its agents must learn, the pre-release status;
- what adopting would cost HERE, in counts, named mechanisms and
  versions — never a grade;
- the weighing: which costs and gains recur every week, which are
  paid once, and which side dominates for the work this repo
  actually does. Say it in one paragraph, and say what it rests on;
- where the FIRST frond would go: a module about to be written, or
  an existing one with many external calls and few tables shared
  with the rest. Name it and say why. If nothing fits, say that.

The last section is "What these numbers do not establish", and it
is written seriously.`;
}
