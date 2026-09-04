# Reading order

Every file of `src/`, in an order where nothing is forward-referenced: each step depends
only on the ones above it. Derived from the import graph by the script at the bottom, not
from taste — regenerate it when the tree moves.

## 1 — The floor

No dependency at all, about 250 lines together.

[`utils.ts`](src/utils.ts) · [`Registry.ts`](src/Registry.ts) · [`judge/RowRefusal.ts`](src/judge/RowRefusal.ts) · [`judge/options.ts`](src/judge/options.ts) · [`judge/result.ts`](src/judge/result.ts)
· [`projection/standard.ts`](src/projection/standard.ts) · [`schema/axis/Meta.ts`](src/schema/axis/Meta.ts) · [`schema/axis/lifecycle/Clock.ts`](src/schema/axis/lifecycle/Clock.ts)
· [`schema/axis/role/Relation.ts`](src/schema/axis/role/Relation.ts) · [`schema/axis/role/Role.ts`](src/schema/axis/role/Role.ts)

## 2 — What fills itself at import

The registries and the axes that read them. A name arrives here as DATA —
`generate: 'ulid'`, `boundary: 'isoDate'` — which is what makes a registry worth having.

[`axis/shape/Formats.ts`](src/schema/axis/shape/Formats.ts) · [`axis/lifecycle/Generators.ts`](src/schema/axis/lifecycle/Generators.ts) · [`axis/boundary/Boundaries.ts`](src/schema/axis/boundary/Boundaries.ts)
· [`fields/constraint/FieldGroup.ts`](src/schema/fields/constraint/FieldGroup.ts) · [`fields/constraint/Unique.ts`](src/schema/fields/constraint/Unique.ts) · [`axis/shape/Shape.ts`](src/schema/axis/shape/Shape.ts)
· [`axis/lifecycle/Lifecycle.ts`](src/schema/axis/lifecycle/Lifecycle.ts) · [`axis/boundary/BoundaryAxis.ts`](src/schema/axis/boundary/BoundaryAxis.ts)

## 3 — The judges

Each is the previous one applied to a wider subject. `validate` returns a verdict,
`assert` throws.

[`judge/EntryJudge.ts`](src/judge/EntryJudge.ts) → [`judge/ValueJudge.ts`](src/judge/ValueJudge.ts) → [`judge/FieldJudge.ts`](src/judge/FieldJudge.ts) → [`judge/RowJudge.ts`](src/judge/RowJudge.ts)

## 4 — The field

The four axes, then what carries them.

[`axis/Axis.ts`](src/schema/axis/Axis.ts) · [`axis/role/RoleAxis.ts`](src/schema/axis/role/RoleAxis.ts) · [`axis/lifecycle/LifecycleAxis.ts`](src/schema/axis/lifecycle/LifecycleAxis.ts)
· [`axis/boundary/Boundary.ts`](src/schema/axis/boundary/Boundary.ts) · [`axis/lifecycle/apply.ts`](src/schema/axis/lifecycle/apply.ts) · [`fields/Field.ts`](src/schema/fields/Field.ts)
· [`fields/FieldSet.ts`](src/schema/fields/FieldSet.ts)

## 5 — What an entity states about itself

[`entity/EntityAdapters.ts`](src/entity/EntityAdapters.ts) · [`entity/EntityAdapterSet.ts`](src/entity/EntityAdapterSet.ts) · [`entity/EntityDeclarations.ts`](src/entity/EntityDeclarations.ts)

## 6 — The schema

`SchemaDefinition` is where a derivation is built; `Schema` is its public face.

[`SchemaDerivation.ts`](src/schema/SchemaDerivation.ts) → [`SchemaView.ts`](src/schema/SchemaView.ts) → [`SchemaDefinition.ts`](src/schema/SchemaDefinition.ts) → [`Schema.ts`](src/schema/Schema.ts) → [`entity.ts`](src/entity.ts)

## 7 — The vocabulary

24 files of 10 to 30 lines, one mould: a word receives a field and answers a field. Read
[`vocabulary/vocabulary.ts`](src/vocabulary/vocabulary.ts) first — it holds the merge rule the other 23 obey.

## 8 — The projections

What a schema becomes for someone who is not holding it.

[`card/Descriptor.ts`](src/projection/card/Descriptor.ts) · [`card/admission.ts`](src/projection/card/admission.ts) · [`card/EntityTypeSource.ts`](src/projection/card/EntityTypeSource.ts)
· [`card/FacadeTypeSource.ts`](src/projection/card/FacadeTypeSource.ts) · [`card/Card.ts`](src/projection/card/Card.ts) · [`card/diff.ts`](src/projection/card/diff.ts) · [`card/Bundle.ts`](src/projection/card/Bundle.ts)
· [`projection/Visibility.ts`](src/projection/Visibility.ts) · [`projection/Cases.ts`](src/projection/Cases.ts) · [`projection/SchemaOrCard.ts`](src/projection/SchemaOrCard.ts)

## 9 — The surface

[`index.ts`](src/index.ts) — 61 imports, the only file that decides what leaves the package.

---

<details><summary>How this order is computed</summary>

Run from the package root. `core` carries the same file, produced by the same script.

```bash
cd src && python3 - <<'PY'
import pathlib, re, collections
files = sorted(str(p) for p in pathlib.Path('.').rglob('*.ts'))
deps = {}
for f in files:
    out = set()
    for m in re.finditer(r"from '(\.[^']+)\.js'", pathlib.Path(f).read_text()):
        t = (pathlib.Path(f).parent / (m.group(1) + '.ts')).resolve()
        try: t = str(t.relative_to(pathlib.Path('.').resolve()))
        except ValueError: continue
        if t in files: out.add(t)
    deps[f] = out

memo = {}
def depth(f, seen=frozenset()):
    if f in memo: return memo[f]
    if f in seen: return 0
    memo[f] = 1 + max((depth(x, seen | {f}) for x in deps[f]), default=-1)
    return memo[f]

for f in files: depth(f)
by = collections.defaultdict(list)
for f in files: by[memo[f]].append(f)
for lvl in sorted(by):
    print(f'--- {lvl} ---')
    for f in sorted(by[lvl]): print(' ', f)
PY
```

`seen` guards the type-only cycles the compiler erases — `judge`↔`schema`,
`projection`↔`schema`, `entity`↔`schema`, which `pnpm arch:cycles` states with their
reason. A file inside a cycle lands at the depth of the first path that reaches it.

</details>
