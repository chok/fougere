# Reading order

66 files of `src/`, in steps: a step depends only on the steps above it, and inside a step
there is nothing to order — a cycle is one step, not a sequence. Derived from the import
graph by the script at the bottom, not from taste — regenerate it when the tree moves.

## 1 — The floor

No dependency at all, 155 lines together.

[`lib/utils.ts`](src/lib/utils.ts) · [`lib/Registry.ts`](src/lib/Registry.ts) · [`result.ts`](src/result.ts) · [`validator/InputRefusal.ts`](src/validator/InputRefusal.ts) · [`validator/options.ts`](src/validator/options.ts)
· [`axis/Meta.ts`](src/axis/Meta.ts) · [`axis/lifecycle/Clock.ts`](src/axis/lifecycle/Clock.ts) · [`axis/role/Relation.ts`](src/axis/role/Relation.ts) · [`projection/standard.ts`](src/projection/standard.ts)

## 2 — What fills itself at import

Two registries, the two axes that read them, and `Role`, which needs only `Relation`. A
name arrives here as DATA — `generate: 'ulid'`, `format: 'siret'` — which is what makes a
registry worth having. `card/admission.ts` lands this early because `result.ts` is all it
needs, and three axes below import it.

[`axis/shape/Formats.ts`](src/axis/shape/Formats.ts) · [`axis/lifecycle/Generators.ts`](src/axis/lifecycle/Generators.ts) · [`axis/role/Role.ts`](src/axis/role/Role.ts) · [`projection/card/admission.ts`](src/projection/card/admission.ts)
· [`axis/shape/Shape.ts`](src/axis/shape/Shape.ts) · [`axis/lifecycle/Lifecycle.ts`](src/axis/lifecycle/Lifecycle.ts)

## 3 — The knot

Ten files that hold each other: no order exists between them, and no subset can be read
first. `Field` names the four axes and two judges, `FieldDeclarationValidator` and `FieldValueValidator` name
`Field` back, each `*Axis.ts` names `Axis.ts` and is named by it, `Boundaries` and
`Boundary` are a registry and its subject, and `Descriptor` is what those axes look like
once written down. Enter by [`field/Field.ts`](src/field/Field.ts) — `new Field(init, key)` is the door the other
nine serve.

[`field/Field.ts`](src/field/Field.ts) · [`axis/Axis.ts`](src/axis/Axis.ts) · [`axis/boundary/Boundary.ts`](src/axis/boundary/Boundary.ts) · [`axis/boundary/Boundaries.ts`](src/axis/boundary/Boundaries.ts)
· [`axis/boundary/BoundaryAxis.ts`](src/axis/boundary/BoundaryAxis.ts) · [`axis/lifecycle/LifecycleAxis.ts`](src/axis/lifecycle/LifecycleAxis.ts) · [`axis/role/RoleAxis.ts`](src/axis/role/RoleAxis.ts)
· [`validator/FieldDeclarationValidator.ts`](src/validator/FieldDeclarationValidator.ts) · [`validator/FieldValueValidator.ts`](src/validator/FieldValueValidator.ts) · [`projection/card/Descriptor.ts`](src/projection/card/Descriptor.ts)

[`validator/AdapterFieldValidator.ts`](src/validator/AdapterFieldValidator.ts) sits at the same step and touches none of it: it judges a foreign
format, which is how an adapter states its own entry shape as JSON.

## 4 — What reads a field

`InputValidator` is the only judge that calls another. `apply.ts` is the only file here that
writes a value rather than reading one.

[`axis/lifecycle/apply.ts`](src/axis/lifecycle/apply.ts) · [`validator/InputValidator.ts`](src/validator/InputValidator.ts) · [`projection/Visibility.ts`](src/projection/Visibility.ts) · [`projection/card/diff.ts`](src/projection/card/diff.ts)
· [`entity/EntityAdapters.ts`](src/entity/EntityAdapters.ts) · [`entity/EntityAdapterSet.ts`](src/entity/EntityAdapterSet.ts) · [`entity/EntityDeclarations.ts`](src/entity/EntityDeclarations.ts)

## 5 — The schema

`SchemaView` and `SchemaDerivation` are one step: the view names the derivation it can
produce and the derivation names the view it comes from. `SchemaDefinition` is where one is
built, `Schema` is its public face.

[`SchemaView.ts`](src/SchemaView.ts) ↔ [`SchemaDerivation.ts`](src/SchemaDerivation.ts) · [`field/FieldSet.ts`](src/field/FieldSet.ts) · [`SchemaDefinition.ts`](src/SchemaDefinition.ts) · [`projection/Cases.ts`](src/projection/Cases.ts)
· [`Schema.ts`](src/Schema.ts)

## 6 — What a schema becomes for someone not holding it

`entity()` is the only name in the package a user types.

[`entity.ts`](src/entity.ts) · [`projection/card/Card.ts`](src/projection/card/Card.ts) · [`projection/SchemaOrCard.ts`](src/projection/SchemaOrCard.ts) · [`projection/card/Bundle.ts`](src/projection/card/Bundle.ts)

## 7 — The surface

[`index.ts`](src/index.ts) — 57 imports, the only file that decides what leaves the package.

## 8 — The vocabulary, any time after step 3

22 files of 10 to 49 lines, 435 together, one mould: a word receives a field and answers a
field. Nothing outside `vocabulary/` imports one except `index.ts`, so the whole directory
is a leaf — it can be read the moment `Field` is known. Read [`vocabulary/vocabulary.ts`](src/vocabulary/vocabulary.ts)
first, it holds the merge rule the seven modifiers obey. Four words stand on another word
(`created` on `date`, `updated` on `created`, `email` and `url` on `text`), and `json` is
the one that stands on a schema: `json(Address)` derives the object's properties and its
required keys, so it wants step 5 behind it.

---

<details><summary>How this order is computed</summary>

Run from the package root. `core` carries the same file, produced by the same script, which
prints finer steps than the sections above group them into.

```bash
cd src && python3 - <<'PY'
import pathlib, re, collections, graphlib

files = sorted(str(p) for p in pathlib.Path('.').rglob('*.ts'))
deps = {f: set() for f in files}
for f in files:
    for m in re.finditer(r"from '(\.[^']+)\.js'", pathlib.Path(f).read_text()):
        target = (pathlib.Path(f).parent / (m.group(1) + '.ts')).resolve()
        try: target = str(target.relative_to(pathlib.Path('.').resolve()))
        except ValueError: continue
        if target in deps: deps[f].add(target)

group = {f: f for f in files}

def condensed():
    graph = collections.defaultdict(set)
    for f in files:
        graph[group[f]] |= {group[d] for d in deps[f]} - {group[f]}
    return graph

while True:
    graph = condensed()
    try:
        order = list(graphlib.TopologicalSorter(graph).static_order())
        break
    except graphlib.CycleError as refusal:
        cycle = set(refusal.args[1])
        kept = min(cycle)
        for f in files:
            if group[f] in cycle: group[f] = kept

depth = {}
for node in order:
    depth[node] = 1 + max((depth[d] for d in graph[node]), default=-1)

step = collections.defaultdict(list)
for f in files: step[depth[group[f]]].append(f)
for level in sorted(step):
    print(f'--- {level} ---')
    cycles = collections.defaultdict(list)
    for f in sorted(step[level]): cycles[group[f]].append(f)
    for members in cycles.values():
        print('  ' + ('  '.join(members) + '   <- one cycle' if len(members) > 1 else members[0]))
PY
```

Files that import each other are merged into one node before the depth is taken, so a
cycle is a step and its members can only be read together. Merging is what makes the answer
reproducible: an earlier version walked the raw graph and stopped at a repeat, which handed
a file the depth of whichever path reached it first — and set iteration order is not stable
across processes, so two runs printed two different orders.

`pnpm arch:cycles` names the four family pairs that cross here — `field`↔`judge`,
`axis`↔`projection`, `axis`↔`field`, `entity`↔`field` — with the reason each is kept.

</details>
