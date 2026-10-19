import { Graph } from '@fougere/graph';
import { lowerFirst, Role } from '@fougere/schema';
import type { FrondDescriptor } from '../../descriptor/FrondDescriptor.js';

/**
 * Every entity, and an edge per `ref()` from the entity that names a row to the entity it names,
 * labelled by the field. A target no frond here declares is still a node: the relation is real,
 * the rows are elsewhere.
 */
export function relationGraph(fronds: readonly FrondDescriptor[]): Graph {
  const relations = new Graph();
  for (const frond of fronds) {
    for (const entity of frond.entities) relations.add(entity.name);
  }

  for (const frond of fronds) {
    for (const entity of frond.entities) {
      for (const [field, declared] of Object.entries(entity.entityClass.getFields())) {
        const role = Role.of(declared);
        if (role.isReference() && role.target?.name) relations.connect(entity.name, lowerFirst(role.target.name), field);
      }
    }
  }

  return relations;
}
