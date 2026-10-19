import { Global, Module } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { AdminGuard, InternalKeyGuard, SameOriginGuard, SessionGuard } from './guards';

@Global()
@Module({
  providers: [SessionsService, SessionGuard, AdminGuard, SameOriginGuard, InternalKeyGuard],
  exports: [SessionsService, SessionGuard, AdminGuard, SameOriginGuard, InternalKeyGuard],
})
export class SessionsModule {}
