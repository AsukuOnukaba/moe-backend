import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { MoeHttpExceptionFilter } from './common/filters/http-exception.filter';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  const origins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  app.enableCors({
    origin: origins.length > 0 ? origins : true,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new MoeHttpExceptionFilter());

  const uploadDirs = ['products', 'avatars', 'store', 'covers'];
  for (const dir of uploadDirs) {
    await fs.mkdir(path.join(process.cwd(), 'uploads', dir), { recursive: true });
  }

  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
