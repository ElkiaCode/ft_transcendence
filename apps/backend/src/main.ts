import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { LoggingInterceptor } from './utils/logger/logger';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const corsOrigins = (process.env.CORS_ORIGIN ?? 'https://localhost')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);

  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.useStaticAssets('/app/uploads', { prefix: '/uploads' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });
  const config = new DocumentBuilder()
    .setTitle('Transcendence API')
    .setVersion('1.0')
    .addBearerAuth() // Recommended so you can test logged-in routes
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document); // This creates the /api route

  await app.listen(process.env.PORT ?? 3001);
  console.log(`Backend is running on port ${process.env.PORT ?? 3001}`);
}
bootstrap().catch((err) => {
  console.error('Error starting server:', err);
  process.exit(1);
});
