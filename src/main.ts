import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { EventBusService } from './core/events/application/event-bus.service';
import { LoggingInterceptor } from './core/logging/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // console.log(process.env.CORS_ORIGINS);
  // console.log(process.env.CORS_ORIGINS?.split(','));

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

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();