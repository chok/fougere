import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlogModule } from './blog/blog.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({ type: 'better-sqlite3', database: 'dev.db', autoLoadEntities: true, synchronize: true }),
    BlogModule,
  ],
})
export class BlogAppModule {}
