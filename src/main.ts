import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { EventBusService } from './core/events/application/event-bus.service';
import { LoggingInterceptor } from './core/logging/logging.interceptor';
import { GlobalExceptionFilter } from './core/logging/global-exception.filter';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // console.log(process.env.CORS_ORIGINS);
  // console.log(process.env.CORS_ORIGINS?.split(','));

  app.use(cookieParser());

  app.enableCors({
    origin: (origin, callback) => {
      const allowedOrigins =
        process.env.CORS_ORIGINS?.split(',') || [];

      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  });

  const eventBus = app.get(EventBusService);
  app.useGlobalInterceptors(
    new LoggingInterceptor(
      eventBus,
    ),
  );

  app.useGlobalFilters(
    new GlobalExceptionFilter(
      eventBus,
    ),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();