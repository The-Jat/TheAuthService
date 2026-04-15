import { Module } from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';
import { DatabaseModule } from '../database/database.module';
import { PostgresApiKeyRepository } from './repositories/postgres-api-key.repository';

@Module({
  imports: [DatabaseModule],
  providers: [
    ApiKeysService,
    {
        provide: 'ApiKeyRepository',
        useClass: PostgresApiKeyRepository
    }
],
  exports: [ApiKeysService],
})
export class ApiKeysModule {}