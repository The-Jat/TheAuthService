import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { PostgresCodeRepository } from './repositories/postgres-code.repository';

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: 'CodeRepository',
      useClass: PostgresCodeRepository,
    },
  ],
  exports: ['CodeRepository'],
})
export class CodeModule {}