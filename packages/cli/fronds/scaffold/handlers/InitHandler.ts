import { join } from 'node:path';
import type ProjectWriter from '../services/ProjectWriter.js';

export default class InitHandler {
  private projectWriter: ProjectWriter;

  constructor(projectWriter: ProjectWriter) {
    this.projectWriter = projectWriter;
  }

  async execute(input: { name: string; template: string; frond?: boolean }): Promise<{ path: string }> {
    // cwd is ambient in a CLI — not a DI service (the container resolves by
    // type, and a bare `string` is not a resolvable dependency).
    const dir = join(process.cwd(), input.name);
    return this.projectWriter.scaffold(dir, input.name, input.template, { frond: input.frond });
  }
}
