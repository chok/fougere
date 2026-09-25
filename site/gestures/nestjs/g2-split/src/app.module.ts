import { Module } from '@nestjs/common';
import { DigestModule } from './digest/digest.module';

@Module({
  imports: [DigestModule],
})
export class AppModule {}
