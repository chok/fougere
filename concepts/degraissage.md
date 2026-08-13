# Trimming a package

The pass run on `@fougere/schema` on 2026-08-13/14, written down so it can be run on the
next package. It is mechanical: every step is a measurement, and the measurement decides.

Do not argue a step before measuring it. Every position defended ahead of its `grep` on
that first pass turned out to be wrong.

## 0. Fix the target

One package. Green before starting: `pnpm -r typecheck && pnpm -r build && pnpm -r test`.
Work on a branch; commit after each step, never at the end.

## 1. Count the readers of every exported symbol

```bash
# per symbol: total occurrences, and occurrences OUTSIDE the package
grep -rn --include=*.ts '\bSymbolName\b' packages demos site | grep -v /dist/
```

Two columns matter: **total** and **outside the package**. Anything at 1 total is its own
declaration and nothing else.

A symbol with no reader outside the package is *not* automatically dead — a published
package exports what a consumer writes (`TextOptions`, `GeneratorRef`). What IS dead:
internal machinery re-exported by the public barrel. Ask of each one: could a consumer
ever have a reason to name this? `createSchemaConstructor` is what `entity()` calls;
`Checked` is a judge's internal return type. Those go.

## 2. Kill the synonyms

A type whose definition is another type is a second name for one thing.

- `AnyField = Field<unknown>` while `class Field<T = unknown>` — `Field` written bare
  already means that. Deleted, 32 sites.
- `FieldError` was `ValidationError` character for character, declared 100 lines away in
  the same package.

Grep for `export type X = Y;` and `export type X = Partial<Y>` — each is a candidate.

## 3. Kill the parallel restatements

Two declarations listing the same members drift. Derive the second from the first.

```ts
// before: the five slots, declared twice
class Field { shape; role; lifecycle; boundary; meta; with() {} }
interface FieldInit { shape; role; lifecycle; boundary; meta }

// after: kept is what is not behaviour — a 6th axis lands on both for free
type FieldData = { [K in keyof Field as Field[K] extends (...a: never[]) => unknown ? never : K]: Field[K] };
```

Say what to KEEP, not what to remove: `Omit<Field, 'with'>` works today and goes stale the
day a second method appears.

Same move one level up: `SchemaLike` restated what `SchemaConstructor` answered, so
`SchemaView` became the read half and `SchemaConstructor extends SchemaView`.

## 4. Kill the duck types

Count the spellings of "something with a `getFields()`". There were four: `SchemaLike`,
`HasFields`, `FormEntity` and an ad-hoc object literal. Each was weaker than the real
thing, so each judged by a looser contract and none would ever see the real one tighten.

Replacing `FieldLike` with the real `Field` made the compiler refuse `shape.enum` — the
consumer had been reading a discriminated union by hand for months.

## 5. Kill the optional members nobody needs

`getOpts?()` and `getUnique?()` cost nine defensive `?.`. Measure who actually answers
less; if it is one caller, make it state its absences rather than have every reader guess.

## 6. Recognize by FORM, never by provenance or presence

- `__brand === 'fougere_field'` asks "did this come through us" — forgeable, and it let
  three fixtures carrying a three-refactor-old vocabulary pass for months.
- `Boolean(value.shape)` asks "is the key there" — `{ shape: 42 }` passed and crashed
  inside the validator; `{ shape: {} }` passed and judged nothing.
- `isShape(value.shape)` asks what it is. That one survives `JSON.stringify`, which is
  where the question is really asked.

`instanceof` is provenance too, and it answers false on anything parsed from JSON.

## 7. One door, and it judges

Every value of the type comes through one constructor, which refuses what is not one and
returns the canonical form. Then no reader downstream asks where anything came from.

The caller adds only the context the type cannot have — `new Field(init, key)`, where
`key` exists solely so the refusal can name the entry.

Verify the door is not bypassed: after `Field` became a class, the compiler found the two
sites building a field by object literal. They had been invisible.

## 8. Pin the invariant with a test, not with a comment

The reason not to write `Object.assign(this, init)` — an own `__proto__` key from parsed
JSON fires the setter and replaces the prototype — is three lines of test. As a comment it
would be deleted by the next person simplifying, legitimately.

Any invariant worth a paragraph is worth a test instead. A comment states what is true, not
the argument for it.

## 9. Re-measure and commit

`typecheck` + `build` + `test`, plus the end-to-end demo that crosses a process boundary
(`pnpm -C demos/multi-frond test` here — card → JSON → other process → reconstruct →
validate). That one catches what unit tests do not.

## What it cost and returned, on `@fougere/schema`

| | |
|---|---|
| `field.ts` | 87 → 45 lines |
| types around a field | 7 → 3, and one of the three is declared by hand |
| duck types for "has fields" | 4 → 1 |
| symbols leaving the public barrel | 7 |
| bugs found by the pass | a shapeless field became an invented `text not null` column; a garbage `lifecycle.create` made a required field optional; `text({ default })` typed required while `validate({})` passed |

Every one of those bugs was found by a measurement taken to answer a design question, not
by looking for bugs.
