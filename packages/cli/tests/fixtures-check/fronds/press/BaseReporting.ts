/** Exportée par son nom, pas en default : la passe d'héritage ne la trouve pas. */
export class BaseReporting {
  async weekly(): Promise<{ count: number }> { return { count: 0 }; }
}
