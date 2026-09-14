export interface RelationConfig {
  /** Type GraphQL cible (retourné par registerType) */
  type: any;
  /** Est-ce une liste ? */
  list?: boolean;
  /** Résolveur personnalisé */
  resolve: (parent: any) => any;
}
