import { Graph } from '@fougere/graph';
import { lowerFirst, Role, type SchemaView } from '@fougere/schema';

/**
 * Every entity, and an edge per `ref()` from the entity that names a row to the entity it names,
 * labelled by the field. A target none of them is still a node: the relation is real, the rows are
 * elsewhere.
 */
export function relationGraph(entities: Iterable<readonly [string, SchemaView]>): Graph {
  const relations = new Graph();
  const declared = [...entities];
  for (const [name] of declared) relations.add(name);

  for (const [name, entity] of declared) {
    for (const [field, value] of Object.entries(entity.getFields())) {
      const role = Role.of(value);
      if (role.isReference() && role.target?.name) relations.connect(name, lowerFirst(role.target.name), field);
    }
  }

  return relations;
}
