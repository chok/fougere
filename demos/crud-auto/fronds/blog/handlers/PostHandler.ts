import { Crud } from "@fougere/core";
import Post from "../entities/Post.js";

export class SearchByTitleInput extends Post.pick("title") {}
export class SearchByTitleOutput extends Post.pick("id", "title") {}
export class PublishInput extends Post.pick("id") {}
export class PublishOutput extends Post.pick("id", "title", "createdAt") {}

/**
 * PostHandler — no service, Crud delegates straight to the repository it was handed.
 * Custom ops reach the rows through the five it inherits: `super.list()`, `super.findById()`.
 */
export default class PostHandler extends Crud(Post) {
  async searchByTitle(
    input: SearchByTitleInput,
  ): Promise<SearchByTitleOutput[]> {
    const { items: all } = await super.list();

    return all
      .filter((p) =>
        String(p.title).toLowerCase().includes(input.title.toLowerCase()),
      )
      .map(({ id, title }) => ({ id: String(id), title: String(title) }));
  }

  async publish(input: PublishInput): Promise<PublishOutput | undefined> {
    console.log(`[PostHandler] Publishing post: ${input.id}`);

    return await super.findById(input.id);
  }
}
