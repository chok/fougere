import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlogModule } from './blog/blog.module';
import { DigestModule } from './digest/digest.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({ type: 'better-sqlite3', database: 'dev.db', autoLoadEntities: true, synchronize: true }),
    BlogModule,
    DigestModule,
  ],
})
export class AppModule {}
