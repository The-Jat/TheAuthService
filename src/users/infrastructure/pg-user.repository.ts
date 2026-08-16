import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { UserRepository } from '../domain/user.repository';
import { User } from '../domain/user';

@Injectable()
export class PgUserRepository implements UserRepository {
  constructor(private db: DatabaseService) { }

  async create(email: string, name: string): Promise<User> {
    const res = await this.db.query(
      `INSERT INTO users (email, name)
       VALUES ($1, $2)
       RETURNING *`,
      [email, name],
    );

    const u = res[0];
    return new User(u.id, u.email, u.name, u.role);
  }

  async createPasswordCredential(
    userId: number,
    passwordHash: string,
  ): Promise<void> {

    const credentialRows = await this.db.query<{
      id: number;
    }>(
      `
    INSERT INTO credentials
    (
      user_id,
      provider
    )
    VALUES
    (
      $1,
      'password'
    )
    RETURNING id
    `,
      [userId],
    );

    const credentialId = credentialRows[0].id;

    await this.db.query(
      `
    INSERT INTO password_credentials
    (
      credential_id,
      password_hash
    )
    VALUES
    (
      $1,
      $2
    )
    `,
      [
        credentialId,
        passwordHash,
      ],
    );
  }

  async findByEmail(email: string): Promise<User | null> {
    const res = await this.db.query(
      `SELECT * FROM users WHERE email = $1`,
      [email],
    );

    if (!res[0]) return null;

    const u = res[0];
    return new User(u.id, u.email, u.name, u.role);
  }

  async findById(id: number): Promise<User | null> {
    const res = await this.db.query(
      `SELECT * FROM users WHERE id = $1`,
      [id],
    );

    if (!res[0]) return null;

    const u = res[0];
    return new User(u.id, u.email, u.name, u.role);
  }
}