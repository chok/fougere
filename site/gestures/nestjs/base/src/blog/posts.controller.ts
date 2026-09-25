import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreatePostDto } from './create-post.dto';
import { PostsService } from './posts.service';

@Controller('posts')
export class PostsController {
  constructor(private posts: PostsService) {}

  @Post()
  create(@Body() input: CreatePostDto) {
    return this.posts.create(input);
  }

  @Get()
  list() {
    return this.posts.list();
  }

  @Post(':id/publish')
  publish(@Param('id') id: string) {
    return this.posts.publish(id);
  }
}
