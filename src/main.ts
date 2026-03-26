import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { MoeHttpExceptionFilter } from './common/filters/http-exception.filter';
import express from 'express';
import path from 'path';
import { promises as fs } from 'fs';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  // Serve uploaded files for local development (e.g., /uploads/avatars/...).
  const uploadsRoot = path.join(process.cwd(), 'uploads');
  await fs.mkdir(uploadsRoot, { recursive: true });
  app.use('/uploads', express.static(uploadsRoot));

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

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
