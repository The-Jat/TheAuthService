import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { config } from './config/config';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/http-exception.filter';
import { AppLogger } from './events/app-logger.service';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: true });

  // Caddy terminates TLS in front of us; trust it for req.ip and req.protocol.
  app.set('trust proxy', config.trustProxy);
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cookieParser());
  app.useBodyParser('urlencoded', { extended: false, limit: '20kb' });
  app.useBodyParser('json', { limit: '100kb' });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter(app.get(AppLogger)));

  // The accounts UI is same-origin. Only endpoints apps call from browsers
  // (userinfo, discovery, jwks, token for public SPA clients) need CORS.
  app.enableCors({
    origin: (origin, cb) => cb(null, !origin || config.corsOrigins.includes(origin) || origin === config.publicUrl),
    credentials: false,
    methods: ['GET', 'POST'],
  });

  app.enableShutdownHooks();
  await app.listen(config.port, '0.0.0.0');
  new Logger('Bootstrap').log(`Auth service listening on :${config.port} (issuer ${config.issuer})`);
}

bootstrap();
