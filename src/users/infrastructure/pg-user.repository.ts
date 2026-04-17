import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { UserRepository } from '../domain/user.repository';
import { User } from '../domain/user';

@Injectable()
export class PgUserRepository implements UserRepository {
  constructor(private db: DatabaseService) {}

  async create(email: string, password: string, name: string): Promise<User> {
    const res = await this.db.query(
      `INSERT INTO users (email, password, name)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [email, password, name],
    );

    const u = res[0];
    return new User(u.id, u.email, u.password, u.name, u.role);
  }

  async findByEmail(email: string): Promise<User | null> {
    const res = await this.db.query(
      `SELECT * FROM users WHERE email = $1`,
      [email],
    );

    if (!res[0]) return null;

    const u = res[0];
    return new User(u.id, u.email, u.password, u.name, u.role);
  }

  async findById(id: number): Promise<User | null> {
    const res = await this.db.query(
      `SELECT * FROM users WHERE id = $1`,
      [id],
    );

    if (!res[0]) return null;

    const u = res[0];
    return new User(u.id, u.email, u.password, u.name, u.role);
  }
}