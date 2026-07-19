import { join } from 'node:path';
import type ProjectWriter from '../services/ProjectWriter.js';

export default class InitHandler {
  private projectWriter: ProjectWriter;
  private cwd: string;

  constructor(projectWriter: ProjectWriter, cwd: string) {
    this.projectWriter = projectWriter;
    this.cwd = cwd;
  }

  async execute(input: { name: string; template: string }): Promise<{ path: string }> {
    const dir = join(this.cwd, input.name);
    return this.projectWriter.scaffold(dir, input.name, input.template);
  }
}
