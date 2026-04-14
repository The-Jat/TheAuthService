import { Module } from '@nestjs/common';
import { InternalController } from './internal.controller';
import { ApiKeysModule } from '../api-keys/api-keys.module';

@Module({
  imports: [ApiKeysModule],
  controllers: [InternalController],
})
export class InternalModule {}