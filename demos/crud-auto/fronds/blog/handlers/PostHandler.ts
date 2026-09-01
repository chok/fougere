import { Crud } from "@fougere/core";
import Post from "../entities/Post.js";

export class SearchByTitleInput extends Post.pick("title") {}
export class SearchByTitleOutput extends Post.pick("id", "title") {}
export class PublishInput extends Post.pick("id") {}
export class PublishOutput extends Post.pick("id", "title", "createdAt") {}

/**
 * PostHandler — no service, Crud delegates straight to the storage it was handed.
 * Custom ops use this.storage, which is the repository Crud received.
 */
export default class PostHandler extends Crud(Post) {
  async searchByTitle(
    input: SearchByTitleInput,
  ): Promise<SearchByTitleOutput[]> {
    const all = await this.storage.list();
    return all
      .filter((p) =>
        String(p.title).toLowerCase().includes(input.title.toLowerCase()),
      )
      .map(({ id, title }) => ({ id: String(id), title: String(title) }));
  }

  async publish(input: PublishInput): Promise<PublishOutput | undefined> {
    console.log(`[PostHandler] Publishing post: ${input.id}`);
    return await this.storage.findById(input.id);
  }
}
