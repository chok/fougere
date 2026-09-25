import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatePostDto } from './create-post.dto';
import { Post } from './post.entity';

@Injectable()
export class PostsService {
  constructor(@InjectRepository(Post) private posts: Repository<Post>) {}

  create(input: CreatePostDto) {
    return this.posts.save(this.posts.create(input));
  }

  list() {
    return this.posts.find();
  }

  async publish(id: string) {
    const post = await this.posts.findOneBy({ id });
    if (!post) throw new NotFoundException(`Post '${id}' not found`);
    if (post.publishedAt) throw new ConflictException('Already published');
    post.publishedAt = new Date();

    return this.posts.save(post);
  }
}
