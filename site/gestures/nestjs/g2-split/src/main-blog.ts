import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { BlogAppModule } from './blog-app.module';

async function bootstrap() {
  const app = await NestFactory.create(BlogAppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
  app.connectMicroservice<MicroserviceOptions>({ transport: Transport.TCP, options: { port: Number(process.env.BLOG_TCP_PORT ?? 3001) } });
  await app.startAllMicroservices();
  await app.listen(Number(process.env.PORT ?? 3000));
}
bootstrap();
