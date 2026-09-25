import { Injectable } from '@nestjs/common';
import { PostsService } from '../blog/posts.service';

@Injectable()
export class DigestService {
  constructor(private posts: PostsService) {}

  async latest() {
    const posts = await this.posts.list();

    return posts
      .filter((post) => post.publishedAt)
      .sort((a, b) => +b.publishedAt! - +a.publishedAt!)
      .slice(0, 3);
  }
}
