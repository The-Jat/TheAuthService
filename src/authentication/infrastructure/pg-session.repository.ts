// src/authentication/infrastructure/pg-session.repository.ts

import { Injectable } from '@nestjs/common';

import { DatabaseService }
    from 'src/database/database.service';

import { SessionRepository }
    from '../domain/session.repository';

import { AuthSession }
    from '../domain/auth-session';

@Injectable()
export class PgSessionRepository
    implements SessionRepository {

    constructor(
        private readonly db:
            DatabaseService,
    ) { }

    async create(data: {
        userId: number;
        sessionTokenHash: string;
        expiresAt: Date;
        ipAddress?: string;
        userAgent?: string;
    }): Promise<void> {

        await this.db.query(
            `
      INSERT INTO auth_sessions
      (
        user_id,
        session_token_hash,
        expires_at,
        ip_address,
        user_agent
      )
      VALUES
      (
        $1,
        $2,
        $3,
        $4,
        $5
      )
      `,
            [
                data.userId,
                data.sessionTokenHash,
                data.expiresAt,
                data.ipAddress ?? null,
                data.userAgent ?? null,
            ],
        );
    }

    async findByTokenHash(
        tokenHash: string,
    ): Promise<AuthSession | null> {

        const rows =
            await this.db.query<AuthSession>(
                `
        SELECT *
        FROM auth_sessions
        WHERE session_token_hash = $1
        LIMIT 1
        `,
                [tokenHash],
            );

        return rows[0] ?? null;
    }

    async revoke(
        sessionId: number,
    ): Promise<void> {

        await this.db.query(
            `
      UPDATE auth_sessions
      SET revoked_at = NOW()
      WHERE id = $1
      `,
            [sessionId],
        );
    }

    async updateLastUsed(
        sessionId: number,
    ): Promise<void> {

        await this.db.query(
            `
      UPDATE auth_sessions
      SET last_used_at = NOW()
      WHERE id = $1
      `,
            [sessionId],
        );
    }
}