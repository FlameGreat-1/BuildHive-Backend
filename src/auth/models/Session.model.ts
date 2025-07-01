import { database } from '../../shared/database';
import { DATABASE_TABLES } from '../../config/auth';

export interface Session {
  id: string;
  userId: string;
  token: string;
  type: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSessionData {
  userId: string;
  token: string;
  type: string;
  expiresAt: Date;
}

export class SessionModel {
  private static tableName = DATABASE_TABLES.SESSIONS;

  static async create(sessionData: CreateSessionData): Promise<Session> {
    const query = `
      INSERT INTO ${this.tableName} (
        user_id, token, type, expires_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, NOW(), NOW())
      RETURNING id, user_id, token, type, expires_at, created_at, updated_at
    `;

    const values = [
      sessionData.userId,
      sessionData.token,
      sessionData.type,
      sessionData.expiresAt
    ];

    const result = await database.query<Session>(query, values);
    return result.rows[0];
  }

  static async findByToken(token: string): Promise<Session | null> {
    const query = `
      SELECT id, user_id, token, type, expires_at, created_at, updated_at
      FROM ${this.tableName}
      WHERE token = $1 AND expires_at > NOW()
    `;

    const result = await database.query<Session>(query, [token]);
    return result.rows[0] || null;
  }

  static async findByUserId(userId: string, type?: string): Promise<Session[]> {
    let query = `
      SELECT id, user_id, token, type, expires_at, created_at, updated_at
      FROM ${this.tableName}
      WHERE user_id = $1 AND expires_at > NOW()
    `;
    
    const values = [userId];

    if (type) {
      query += ' AND type = $2';
      values.push(type);
    }

    query += ' ORDER BY created_at DESC';

    const result = await database.query<Session>(query, values);
    return result.rows;
  }

  static async deleteByToken(token: string): Promise<void> {
    const query = `DELETE FROM ${this.tableName} WHERE token = $1`;
    await database.query(query, [token]);
  }

  static async deleteByUserId(userId: string, type?: string): Promise<void> {
    let query = `DELETE FROM ${this.tableName} WHERE user_id = $1`;
    const values = [userId];

    if (type) {
      query += ' AND type = $2';
      values.push(type);
    }

    await database.query(query, values);
  }

  static async cleanupExpired(): Promise<number> {
    const query = `DELETE FROM ${this.tableName} WHERE expires_at <= NOW()`;
    const result = await database.query(query);
    return result.rowCount;
  }

  static async updateExpiry(token: string, expiresAt: Date): Promise<void> {
    const query = `
      UPDATE ${this.tableName}
      SET expires_at = $1, updated_at = NOW()
      WHERE token = $2
    `;

    await database.query(query, [expiresAt, token]);
  }
}
