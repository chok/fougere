import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { DigestController } from './digest.controller';
import { DigestService } from './digest.service';

@Module({
  imports: [ClientsModule.register([{ name: 'BLOG', transport: Transport.TCP, options: { port: Number(process.env.BLOG_TCP_PORT ?? 3001) } }])],
  controllers: [DigestController],
  providers: [DigestService],
})
export class DigestModule {}
