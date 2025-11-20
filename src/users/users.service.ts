import { Injectable, NotFoundException } from '@nestjs/common';
import { PoolClient, QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service';
import { UserEntity } from './user.entity';

export interface CreateUserInput {
  uid: string;
  provider: string;
  displayName?: string | null;
  email?: string | null;
  isAnonymous: boolean;
}

@Injectable()
export class UsersService {
  constructor(private readonly db: DatabaseService) {}

  async findByUid(uid: string): Promise<UserEntity | null> {
    const result = await this.db.query<UserRow>(
      'SELECT * FROM users WHERE uid = $1 LIMIT 1',
      [uid],
    );
    if (result.rowCount === 0) {
      return null;
    }
    return this.mapRow(result.rows[0]);
  }

  async findById(userId: number): Promise<UserEntity> {
    const result = await this.db.query<UserRow>(
      'SELECT * FROM users WHERE id = $1 LIMIT 1',
      [userId],
    );
    if (result.rowCount === 0) {
      throw new NotFoundException('User not found');
    }
    return this.mapRow(result.rows[0]);
  }

  async create(data: CreateUserInput): Promise<UserEntity> {
    const result = await this.db.query<UserRow>(
      `
        INSERT INTO users (uid, provider, display_name, email, is_anonymous)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *;
      `,
      [
        data.uid,
        data.provider,
        data.displayName ?? null,
        data.email ?? null,
        data.isAnonymous,
      ],
    );
    return this.mapRow(result.rows[0]);
  }

  async incrementCredits(
    userId: number,
    amount: number,
    client?: PoolClient,
  ): Promise<{ balance: number }> {
    if (client) {
      const result = await client.query<UserBalanceRow>(
        `
          UPDATE users
          SET credits = credits + $1, updated_at = NOW()
          WHERE id = $2
          RETURNING credits;
        `,
        [amount, userId],
      );
      if (result.rowCount === 0) {
        throw new NotFoundException('User not found');
      }
      return { balance: result.rows[0].credits };
    }

    const result = await this.db.query<UserBalanceRow>(
      `
        UPDATE users
        SET credits = credits + $1, updated_at = NOW()
        WHERE id = $2
        RETURNING credits;
      `,
      [amount, userId],
    );
    if (result.rowCount === 0) {
      throw new NotFoundException('User not found');
    }
    return { balance: result.rows[0].credits };
  }

  async updateProfile(
    userId: number,
    data: Partial<CreateUserInput>,
  ): Promise<UserEntity> {
    const current = await this.findById(userId);
    const result = await this.db.query<UserRow>(
      `
        UPDATE users
        SET provider = $2,
            display_name = $3,
            email = $4,
            is_anonymous = $5,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *;
      `,
      [
        userId,
        data.provider ?? current.provider,
        data.displayName ?? current.displayName,
        data.email ?? current.email,
        data.isAnonymous ?? current.isAnonymous,
      ],
    );
    return this.mapRow(result.rows[0]);
  }

  private mapRow(row: UserRow): UserEntity {
    return {
      id: row.id,
      uid: row.uid,
      provider: row.provider,
      displayName: row.display_name,
      email: row.email,
      isAnonymous: row.is_anonymous,
      credits: row.credits,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

interface UserRow extends QueryResultRow {
  id: number;
  uid: string;
  provider: string;
  display_name: string | null;
  email: string | null;
  is_anonymous: boolean;
  credits: number;
  created_at: string;
  updated_at: string;
}

interface UserBalanceRow extends QueryResultRow {
  credits: number;
}
