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
  return `# Audit: what this repo would have avoided, and what one module costs to move

This audit is hypothetical. Assume Fougere does exactly what the model
below states — nothing more, nothing less — and judge THIS repository's
code against it. Do not evaluate Fougere's version, maturity, docs or
backlog: they change every week, and this audit must not.

Fougere is added beside what exists. Adding it and writing new code in
it from day one changes nothing that exists: that step costs the
existing code nothing, and the report says so. Moving existing modules
is the rest, and it happens at the team's pace, one module at a time.
Never weigh a rewrite of the whole repository: the question is never
"adopt or not", it is "what would a module have avoided, and what does
moving it cost". Report what would get worse as carefully as what
improves.

## The model — the only source of claims about Fougere

The docs explain it at ${origin}/docs. Claim nothing beyond what
this section states.

One rule: a declaration names nothing outside itself — no table, no
protocol, no host, no address. What it does not name is either derived
from it, or chosen outside it.

- Shape. A business object is declared once, as a class:

      class Post extends entity({
        id: primary(),
        title: text({ min: 1, max: 160 }),
        status: readOnly(oneOf('draft', 'published', { default: 'draft' })),
      }) {}

  Validation (the same in the browser and at the API, unknown keys
  refused), the table, the migration from one version to the next, the
  form contract, the API surfaces and the TS type are derived from it.
- Operations. A handler method is an operation. Its signature is its
  contract: what it takes, what it returns, and what it can refuse —
  found wherever it is thrown, and published to the caller's types.
- Wiring. Nothing is registered by hand. A class in a convention folder
  is found; its constructor parameter types are its dependencies. A
  missing dependency stops the boot, naming the class.
- Ports. \`class StripePayment extends Payment\` is the registration. A
  retry or a cache is a class that extends the port and asks for it,
  stacked in front by config. A test stub is derived from the port.
- Boundaries. Code lives in modules (fronds). A frond does not touch
  another frond's rows: it calls its operations, or announces a fact
  that others subscribe to by signature. Where a frond runs is config;
  the code is the same in one process or several, so a frond can run in
  its own process beside an app in another language, called over HTTP.
- Rows. A frond reads and writes through its storage's gestures (get,
  list, create, update, delete...). A query beyond them — a join across
  entities, an aggregate, full-text — is written against the engine,
  outside the derived validation.
- Computed fields. A presenter receives the page of rows, not one row.
- Identity. Who calls reaches an operation as a typed value, resolved
  once per call.
- Observability. A log line says which class wrote it and which
  operation was running. A span per operation carries its own time and
  its query count. An expected refusal and a bug differ by type.

## Rules for every number

- Every sentence carries a unit the reader can recount: a count, or a
  path plus a symbol. Quote the command you ran.
- A section that finds nothing writes "nothing". It is a result.
- Only section 0 gives a weight.
- A line that moves (into an entity, into config) is not a line removed.
  Say where each one goes.
- Audit what is written in TypeScript against the model. For any other
  language, measure what does not need a rewrite (sections 0, 1, 3), and
  price a module as a TS frond in its own process beside the existing
  app — never as a rewrite of the app.
- The repository is read-only: never write to it, never run anything
  that writes. A rewrite lives in the report.

## 0. Where the work goes

Count the commits that change a business rule (a condition, a
computation, a state transition, a field with a meaning), against all
commits. Start with the last 12 months; widen the window until it holds
at least 20 such commits, and name the window. Say how you recognized
them.

Take 20 of them. For each: the lines that state the rule, and the lines
touched around it. Report the median ratio and the median number of
files touched per change. This weighs everything below.

## 1. What would have been avoided

This is the core of the audit. Find, in the code and in the history,
every place where one rule, one list or one contract is declared in two
places that disagree, and every incident that came from it. For each:

- the two declarations, both quoted with path and symbol;
- what breaks between them, as a concrete input and its wrong output —
  read in the code, and say it was not executed;
- the commits it cost, if the history shows them (a fix, a revert, a
  hotfix, a rename spread over weeks), counted;
- the mechanism of the model that makes it impossible, from the model
  above only.

Sweep at least: validation against the database (a rule the model
states and the table does not hold, or the reverse); the same filter or
rule copied into several functions; an enum or a status list declared
in several files; a contract copied into another repository or service
(a schema file, a client, a list of error codes matched by string); a
migration that destroyed or reset stored values; refusals a caller
cannot tell from bugs.

## 2. Business code, line by line

Pick the five business files changed most often
(\`git log --since=<window> --format= --name-only | sort | uniq -c | sort -rn\`).
Classify every line:

- decision — a rule, a computation, a branch on business state;
- ceremony — one of: wiring; shape declared again (mapping, DTOs,
  re-validation); error translation; plumbing of an external system
  (retry, timeout, auth headers); per-row fetching; logger setup;
  where-it-runs (base URLs, per-service env vars, host request objects);
  transaction and pagination boilerplate;
- engine — a query the model leaves to the engine (see Rows).

Report the three shares, and ceremony by category. If a script
classifies, say which class is the residue: its count is a ceiling.

## 3. Candidate modules, each priced

Name two or three modules that could become the first frond: one about
to be written, or an existing one with many external calls and few rows
shared with the rest. For each, price the move alone:

- what it owns: tables, entities, endpoints or operations, external
  systems it calls — counted;
- what changes in the rest of the repository to call it instead: call
  sites, imports, routes — counted. Everything else is untouched and
  costs nothing;
- what it would stop paying, per business change, from sections 0-2;
- what it uses that has no place in the model (engine queries, search
  index, durable multi-step workflows, job queues, a non-SQL store, a
  federated schema) — counted, and how the frond would keep calling it
  (a port, or leaving it where it is);
- for a repository in another language: the second runtime this adds
  (a process to host, a deployment, a language for the team), stated as
  a cost, and the HTTP calls the existing app would make to it.

Rewrite one operation of the first candidate against the model,
behaviour identical. Report lines before and after, and for every
removed line where it went: derived (written nowhere), moved to an
entity, moved to config.

## 4. Reading by an agent

For three operations of section 2: to know what each takes, returns,
refuses and which modules it reaches, how many files and lines did you
open? Under the model the answer is its signature: say how many of
those lines it replaces.

Count the rules in this repo's instruction files (CLAUDE.md, AGENTS.md,
.cursorrules, CONTRIBUTING, .claude/rules) that must be followed by
hand, like "update X when you change Y".

State plainly: this repo's stack is in every model's training data, and
Fougere is not. Say what that is worth here.

## Report

Lead with section 0. Then, in this order:

0. Day one — adding Fougere beside this code and writing the next new
   module in it. Name that module if the history or the open work shows
   one, and say what it changes in the existing code: nothing.
1. What would have been avoided — section 1, one row per finding, with
   the commits it cost.
2. The first frond — the chosen candidate of section 3, its price, what
   it stops paying, and what stays outside the model.
3. The path after it: which module would come second, and what the
   first one makes cheaper for it.
4. What the repository already gets for free — derived types, generated
   clients, checked wiring, auto-instrumentation. Not gains.
5. What would get worse, for the first frond only, counted.

The last section is "What these numbers do not establish", written
seriously. It includes, by construction: the audit assumes the model
holds and does not check that Fougere delivers it today; the rewrite was
done by the auditor and favours it; findings read in the code were not
executed; the auditor read the model before measuring section 4.`;
}
