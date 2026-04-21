import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
         rejectUnauthorized: false,
      }
    });
  }

  async onModuleInit() {
    await this.pool.connect();
    console.log('✅ PostgreSQL connected');
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  async query<T = any>(text: string, params?: any[]): Promise<T[]> {
    const res = await this.pool.query(text, params);
    return res.rows;
  }
}