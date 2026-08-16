import {
    Body,
    Controller,
    Logger,
    Post,
} from '@nestjs/common';

import { DiscoveryService } from '../application/discovery.service';

import { AuthenticationService } from '../application/authentication.service';
import { AuthProviderType } from '../domain/auth-provider.types';
import { SessionService } from '../application/session.service';

@Controller('auth')
export class AuthenticationController {
    private readonly logger = new Logger(AuthenticationController.name,);
    constructor(
        private readonly discoveryService:
            DiscoveryService,

        private readonly authenticationService: AuthenticationService,
        
        private readonly sessionService: SessionService,
    ) { }

    @Post('discover')
    async discover(

        @Body() body: {
            email: string;
        },
    ) {
        this.logger.log(`Discovery request received for ${body.email}`);
        return {
            available_methods:
                await this.discoveryService.discover(body.email),
        };
    }

    @Post('authenticate')
    async authenticate(
        @Body() body: {
            provider: AuthProviderType;
            payload: any;
        },
    ) {
        this.logger.log(`Authenticating provider: ${body.provider}`);

        const result = await this.authenticationService
            .authenticate(
                body.provider,
                body.payload,
            );
        
        return {
            userId: result.userId,
        };
    }

    @Post('test-session')
async testSession() {

  const token =
    await this.sessionService
      .createSession(1);

  return {
    token,
  };
}
}