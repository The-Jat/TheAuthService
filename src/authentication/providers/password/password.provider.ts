import {
    Injectable,
    Inject,
    Logger
} from '@nestjs/common';

import * as bcrypt from 'bcrypt';

import { User } from 'src/users/domain/user';

import type { UserRepository } from 'src/users/domain/user.repository';
import type { AuthenticationProvider } from '../../domain/authentication-provider';
import type { PasswordLoginRequest } from '../../domain/password-login.request';
import { AuthProviderType } from 'src/authentication/domain/auth-provider.types';
import type { CredentialRepository } from 'src/authentication/domain/credential.repository';

@Injectable()
export class PasswordProvider
    implements AuthenticationProvider<PasswordLoginRequest> {

    private readonly logger = new Logger(PasswordProvider.name);

    constructor(
        @Inject('UserRepository')
        private readonly userRepo: UserRepository,

        @Inject('CredentialRepository')
        private readonly credentialRepo: CredentialRepository,
    ) { }

    type(): AuthProviderType {
        return AuthProviderType.PASSWORD;
    }

    async authenticate(
        request: PasswordLoginRequest,
    ): Promise<User | null> {

        this.logger.log(
            `Password authentication attempt for ${request.email}`,
        );

        try {
            const credential = await this.credentialRepo.findPasswordCredentialByEmail(request.email);
            if (!credential) {
                this.logger.warn(`Authentication failed: user not found for ${request.email}`);
                return null;
            }
            const valid = await bcrypt.compare(
                request.password,
                credential.password_hash,
            );

            if (!valid) {
                this.logger.warn(`Authentication failed: invalid password for ${request.email}`);
                return null;
            }
            return this.userRepo.findById(credential.user_id);
        } catch (error) {
            this.logger.error(
                `Password authentication error for ${request.email}`,
                error instanceof Error ? error.stack : String(error),
            );

            throw error;
        }
    }
}