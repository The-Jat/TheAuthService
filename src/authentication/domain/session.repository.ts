// src/sessions/domain/session.repository.ts

import { AuthSession } from "./auth-session";

export interface SessionRepository {
    create(data: {
        userId: number;
        sessionTokenHash: string;
        expiresAt: Date;
        ipAddress?: string;
        userAgent?: string;
    }): Promise<void>;

    findByTokenHash(
        tokenHash: string,
    ): Promise<AuthSession | null>;

    revoke(sessionId: number): Promise<void>;

    updateLastUsed(
        sessionId: number,
    ): Promise<void>;

    // findByToken(
    //     token: string,
    // ): Promise<AuthSession | null>;
}