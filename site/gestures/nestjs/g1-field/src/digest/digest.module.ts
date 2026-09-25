import { Module } from '@nestjs/common';
import { BlogModule } from '../blog/blog.module';
import { DigestController } from './digest.controller';
import { DigestService } from './digest.service';

@Module({
  imports: [BlogModule],
  controllers: [DigestController],
  providers: [DigestService],
})
export class DigestModule {}
