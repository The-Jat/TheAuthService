import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class UsersService {
  constructor(private db: DatabaseService) {}

  async createUser(email: string, password: string, name: string) {
    const users = await this.db.query(
      `INSERT INTO users (email, password, name)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [email, password, name],
    );

    return users[0];
  }

  async findByEmail(email: string) {
    const users = await this.db.query(
      `SELECT * FROM users WHERE email = $1`,
      [email],
    );

    return users[0];
  }
}