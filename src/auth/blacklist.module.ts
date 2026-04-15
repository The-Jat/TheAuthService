import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { PostgresBlacklistRepository } from './repositories/postgres-blacklist.repository';

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: 'BlacklistRepository',
      useClass: PostgresBlacklistRepository,
    },
  ],
  exports: ['BlacklistRepository'],
})
export class BlacklistModule {}