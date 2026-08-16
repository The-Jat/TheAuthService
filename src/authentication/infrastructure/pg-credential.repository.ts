// src/authentication/infrastructure/pg-credential.repository.ts

import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

import { CredentialRepository }
    from '../domain/credential.repository';

import { AuthProviderType }
    from '../domain/auth-provider.types';

@Injectable()
export class PgCredentialRepository
    implements CredentialRepository {

    constructor(
        private readonly db: DatabaseService,
    ) { }

    async findMethodsByEmail(
        email: string,
    ): Promise<AuthProviderType[]> {

        const rows = await this.db.query<{
            provider: string;
        }>(
            `
      SELECT c.provider
      FROM credentials c
      INNER JOIN users u
        ON u.id = c.user_id
      WHERE u.email = $1
      `,
            [email],
        );

        return rows.map(
            row =>
                row.provider as AuthProviderType,
        );
    }

    async findPasswordCredentialByEmail(
        email: string,
    ): Promise<{
        user_id: number;
        password_hash: string;
    } | null> {

        const rows = await this.db.query<{
            user_id: number;
            password_hash: string;
        }>(
            `
    SELECT
      c.user_id,
      pc.password_hash
    FROM credentials c

    INNER JOIN password_credentials pc
      ON pc.credential_id = c.id

    INNER JOIN users u
      ON u.id = c.user_id

    WHERE
      u.email = $1
      AND c.provider = 'password'

    LIMIT 1
    `,
            [email],
        );

        return rows[0] ?? null;
    }
}