export interface EntityNode {
  name: string;
  frond: string;
  refs: string[];       // entity names this entity references
  referencedBy: string[]; // entity names that reference this entity
}
