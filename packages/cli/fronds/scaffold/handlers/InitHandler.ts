import { join } from 'node:path';
import type ProjectWriter from '../services/ProjectWriter.js';

export default class InitHandler {
  private projectWriter: ProjectWriter;

  constructor(projectWriter: ProjectWriter) {
    this.projectWriter = projectWriter;
  }

  async execute(input: { name: string }): Promise<{ path: string }> {
    // cwd is ambient in a CLI, not a DI service.
    const dir = join(process.cwd(), input.name);
    return this.projectWriter.createWorkspace(dir, input.name);
  }
}
