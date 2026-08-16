// src/authentication/application/session.service.ts
import * as crypto from 'crypto';

import {
    Injectable,
    Inject,
} from '@nestjs/common';

import type { SessionRepository }
    from '../domain/session.repository';

@Injectable()
export class SessionService {

    constructor(
        @Inject('SessionRepository')
        private readonly sessionRepo:
            SessionRepository,
    ) { }

    async createSession(
        userId: number,
        ipAddress?: string,
        userAgent?: string,
    ): Promise<string> {

        const sessionToken =
            crypto.randomBytes(32)
                .toString('hex');

        const tokenHash =
            crypto
                .createHash('sha256')
                .update(sessionToken)
                .digest('hex');

        const expiresAt =
            new Date(
                Date.now() +
                30 * 24 * 60 * 60 * 1000,
            );

        await this.sessionRepo.create({
            userId,
            sessionTokenHash: tokenHash,
            expiresAt,
            ipAddress,
            userAgent,
        });

        return sessionToken;
    }

    async validateSession(
        sessionToken: string,
    ): Promise<number | null> {

        const tokenHash =
            crypto
                .createHash('sha256')
                .update(sessionToken)
                .digest('hex');

        const session =
            await this.sessionRepo
                .findByTokenHash(
                    tokenHash,
                );

        if (!session) {
            return null;
        }

        if (session.revoked_at) {
            return null;
        }

        if (
            session.expires_at.getTime()
            < Date.now()
        ) {
            return null;
        }

        await this.sessionRepo
            .updateLastUsed(
                session.id,
            );

        return session.user_id;
    }

    async revokeSession(
        sessionId: number,
    ): Promise<void> {

        await this.sessionRepo
            .revoke(sessionId);
    }

    // async findByToken(token: string) {
    //     return this.sessionRepo.findByToken(token);
    // }
}