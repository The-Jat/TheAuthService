import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { Pool, PoolClient, QueryResultRow } from 'pg';
import { config } from '../config/config';

export type Queryable = Pick<PoolClient, 'query'>;

/**
 * Thin wrapper over a pg pool. Runs pending SQL migrations at startup, guarded
 * by an advisory lock so two replicas never migrate at the same time.
 */
@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly pool = new Pool({ connectionString: config.databaseUrl, max: 10 });

  async onModuleInit() {
    await this.migrate();
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  async query<T extends QueryResultRow = any>(sql: string, params: unknown[] = [], client?: Queryable): Promise<T[]> {
    const result = await (client ?? this.pool).query<T>(sql, params as any[]);
    return result.rows;
  }

  async one<T extends QueryResultRow = any>(sql: string, params: unknown[] = [], client?: Queryable): Promise<T | null> {
    const rows = await this.query<T>(sql, params, client);
    return rows[0] ?? null;
  }

  /** Runs `fn` inside a transaction; rolls back on any thrown error. */
  async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  private async migrate() {
    const dir = join(__dirname, 'migrations');
    const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
    const client = await this.pool.connect();
    try {
      await client.query('SELECT pg_advisory_lock(727001)');
      await client.query(
        `CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`,
      );
      const applied = new Set(
        (await client.query<{ version: string }>('SELECT version FROM schema_migrations')).rows.map((r) => r.version),
      );
      for (const file of files) {
        if (applied.has(file)) continue;
        this.logger.log(`Applying migration ${file}`);
        await client.query('BEGIN');
        try {
          await client.query(readFileSync(join(dir, file), 'utf8'));
          await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
          await client.query('COMMIT');
        } catch (err) {
          await client.query('ROLLBACK');
          throw new Error(`Migration ${file} failed: ${err.message}`);
        }
      }
    } finally {
      await client.query('SELECT pg_advisory_unlock(727001)').catch(() => undefined);
      client.release();
    }
  }
}
