import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool?: Pool;

  get isReady(): boolean {
    return Boolean(this.pool);
  }

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const connectionString = this.config.get<string>('DATABASE_URL');
    if (!connectionString) {
      throw new Error(
        'DATABASE_URL is not set. Please provide a Postgres connection string.',
      );
    }

    const isNeon = connectionString.includes('neondb');
    const sslSetting = isNeon ? { rejectUnauthorized: false } : false;

    this.pool = new Pool({
      connectionString,
      ssl: sslSetting,
      max: Number(this.config.get<number>('DATABASE_POOL_MAX') ?? 10),
    });

    await this.ensureSchema();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = undefined;
    }
  }

  async query<T extends QueryResultRow>(
    sql: string,
    params: Array<string | number | boolean | null> = [],
  ): Promise<QueryResult<T>> {
    const pool = this.pool;
    if (!pool) {
      throw new Error('Database pool not initialized');
    }
    return pool.query<T>(sql, params);
  }

  async withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const pool = this.pool;
    if (!pool) {
      throw new Error('Database pool not initialized');
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async queryWithClient<T extends QueryResultRow>(
    client: PoolClient,
    sql: string,
    params: Array<string | number | boolean | null> = [],
  ): Promise<QueryResult<T>> {
    return client.query<T>(sql, params);
  }

  private async ensureSchema(): Promise<void> {
    if (!this.pool) {
      return;
    }
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        uid TEXT NOT NULL UNIQUE,
        provider TEXT NOT NULL,
        display_name TEXT,
        email TEXT,
        is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
        credits INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS purchases (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        purchase_id TEXT NOT NULL UNIQUE,
        product_id TEXT NOT NULL,
        platform TEXT NOT NULL,
        verification_data TEXT,
        verification_result JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  }
}
