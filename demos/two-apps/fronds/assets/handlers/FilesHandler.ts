import type Files from '../entities/Files.js';

/** Asks the files service it was handed, wherever it runs. */
export default class FilesHandler {
  constructor(private files: Files) {}

  url(): string {
    return this.files.url;
  }

  async status(): Promise<number> {
    const response = await fetch(this.files.url);

    return response.status;
  }
}
