import Post from '../entities/Post.js';

export default class PostHandler {
  async publish(id: Post['id']): Promise<string> {
    return id;
  }

  async retitle(id: Post['id'], title: Post['title']): Promise<string> {
    return `${id} ${title}`;
  }
}
