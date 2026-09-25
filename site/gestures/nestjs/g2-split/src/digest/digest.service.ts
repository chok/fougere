import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import type { Post } from '../blog/post.entity';

@Injectable()
export class DigestService {
  constructor(@Inject('BLOG') private blog: ClientProxy) {}

  async latest() {
    const posts = await firstValueFrom(this.blog.send<Post[]>('posts.list', {}));

    return posts
      .filter((post) => post.publishedAt)
      .sort((a, b) => +new Date(b.publishedAt!) - +new Date(a.publishedAt!))
      .slice(0, 3);
  }
}
