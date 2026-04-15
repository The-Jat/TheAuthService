import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { PostgresTokenRepository } from './repositories/postgres-token.repository';

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: 'TokenRepository',
      useClass: PostgresTokenRepository,
    },
  ],
  exports: ['TokenRepository'],
})
export class TokenModule {}