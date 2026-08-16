// src/oauth/application/oauth-login.service.ts

import {
    Injectable,
    Logger,
} from '@nestjs/common';

import { AuthenticationService } from 'src/authentication/application/authentication.service';

import { OAuthService } from './oauth.service';

import { OAuthLoginRequest } from './oauth-login.request';

import { OAuthLoginResponse } from './oauth-login.response';
import { SessionService } from 'src/authentication/application/session.service';

@Injectable()
export class OAuthLoginService {

    private readonly logger =
        new Logger(OAuthLoginService.name);

    constructor(
        private readonly authenticationService: AuthenticationService,
        private readonly sessionService: SessionService,
        private readonly oauthService: OAuthService,
    ) { }

    async login(
        request: OAuthLoginRequest,
    ): Promise<OAuthLoginResponse> {

        this.logger.log(`OAuth login using ${request.provider}`,);

        const authResult =
            await this.authenticationService
                .authenticate(
                    request.provider,
                    request.payload,
                );

        // SSO session
        const sessionToken =
            await this.sessionService.createSession(
                authResult.userId,
            );

        const code =
            await this.oauthService.generateCode(
                authResult.userId,
                request.client_id,
                request.redirect_uri,
                request.code_challenge,
                request.code_challenge_method,
            );

        this.logger.log(
            `OAuth code generated for user ${authResult.userId}`,
        );

        return {
            sessionToken,
            redirect_to:
                `${request.redirect_uri}` +
                `?code=${code}` +
                `&state=${request.state}`,
        };
    }
}