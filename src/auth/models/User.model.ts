import { database } from '../../shared/database';
import { User, CreateUserData, UserExistsCheck } from '../types';
import { UserRole, UserStatus, AuthProvider } from '../../shared/types';
import { DATABASE_TABLES } from '../../config/auth';

export class UserModel {
  private static tableName = DATABASE_TABLES.USERS;

  static async create(userData: CreateUserData): Promise<User> {
    const query = `
      INSERT INTO ${this.tableName} (
        username, email, password_hash, role, status, auth_provider, 
        social_id, email_verified
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, username, email, password_hash, role, status, auth_provider, 
                social_id, email_verified, created_at, updated_at
    `;

    const values = [
      userData.username,
      userData.email,
      userData.password || null,
      userData.role,
      UserStatus.PENDING,
      userData.authProvider,
      userData.socialId || null,
      userData.authProvider !== AuthProvider.LOCAL
    ];

    const result = await database.query<any>(query, values);
    const row = result.rows[0];
    
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      passwordHash: row.password_hash,
      role: row.role,
      status: row.status,
      authProvider: row.auth_provider,
      socialId: row.social_id,
      emailVerified: row.email_verified,
      loginAttempts: 0,
      lockedUntil: undefined,
      lastLoginAt: undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  static async findByEmail(email: string): Promise<User | null> {
    const query = `
      SELECT id, username, email, password_hash, role, status, 
             auth_provider, social_id, email_verified, 
             email_verification_token, email_verification_expires,
             password_reset_token, password_reset_expires,
             login_attempts, locked_until, last_login_at,
             created_at, updated_at
      FROM ${this.tableName}
      WHERE email = $1
    `;

    const result = await database.query<any>(query, [email]);
    if (!result.rows[0]) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      passwordHash: row.password_hash,
      role: row.role,
      status: row.status,
      authProvider: row.auth_provider,
      socialId: row.social_id,
      emailVerified: row.email_verified,
      emailVerificationToken: row.email_verification_token,
      emailVerificationExpires: row.email_verification_expires,
      passwordResetToken: row.password_reset_token,
      passwordResetExpires: row.password_reset_expires,
      loginAttempts: row.login_attempts || 0,
      lockedUntil: row.locked_until,
      lastLoginAt: row.last_login_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  static async findByUsername(username: string): Promise<User | null> {
    const query = `
      SELECT id, username, email, password_hash, role, status, 
             auth_provider, social_id, email_verified,
             login_attempts, locked_until, last_login_at,
             created_at, updated_at
      FROM ${this.tableName}
      WHERE username = $1
    `;

    const result = await database.query<any>(query, [username]);
    if (!result.rows[0]) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      passwordHash: row.password_hash,
      role: row.role,
      status: row.status,
      authProvider: row.auth_provider,
      socialId: row.social_id,
      emailVerified: row.email_verified,
      loginAttempts: row.login_attempts || 0,
      lockedUntil: row.locked_until,
      lastLoginAt: row.last_login_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  static async findBySocialId(socialId: string, provider: AuthProvider): Promise<User | null> {
    const query = `
      SELECT id, username, email, password_hash, role, status, auth_provider, 
             social_id, email_verified, login_attempts, locked_until, last_login_at,
             created_at, updated_at
      FROM ${this.tableName}
      WHERE social_id = $1 AND auth_provider = $2
    `;

    const result = await database.query<any>(query, [socialId, provider]);
    if (!result.rows[0]) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      passwordHash: row.password_hash,
      role: row.role,
      status: row.status,
      authProvider: row.auth_provider,
      socialId: row.social_id,
      emailVerified: row.email_verified,
      loginAttempts: row.login_attempts || 0,
      lockedUntil: row.locked_until,
      lastLoginAt: row.last_login_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  static async findById(id: string): Promise<User | null> {
    const query = `
      SELECT id, username, email, password_hash, role, status, 
             auth_provider, social_id, email_verified,
             login_attempts, locked_until, last_login_at,
             created_at, updated_at
      FROM ${this.tableName}
      WHERE id = $1
    `;

    const result = await database.query<any>(query, [parseInt(id, 10)]);
    if (!result.rows[0]) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      passwordHash: row.password_hash,
      role: row.role,
      status: row.status,
      authProvider: row.auth_provider,
      socialId: row.social_id,
      emailVerified: row.email_verified,
      loginAttempts: row.login_attempts || 0,
      lockedUntil: row.locked_until,
      lastLoginAt: row.last_login_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  static async findByPasswordResetToken(token: string): Promise<User | null> {
    const query = `
      SELECT id, username, email, password_hash, role, status, 
             auth_provider, social_id, email_verified,
             password_reset_token, password_reset_expires,
             login_attempts, locked_until, last_login_at,
             created_at, updated_at
      FROM ${this.tableName}
      WHERE password_reset_token = $1 AND password_reset_expires > NOW()
    `;

    const result = await database.query<any>(query, [token]);
    if (!result.rows[0]) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      passwordHash: row.password_hash,
      role: row.role,
      status: row.status,
      authProvider: row.auth_provider,
      socialId: row.social_id,
      emailVerified: row.email_verified,
      passwordResetToken: row.password_reset_token,
      passwordResetExpires: row.password_reset_expires,
      loginAttempts: row.login_attempts || 0,
      lockedUntil: row.locked_until,
      lastLoginAt: row.last_login_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  static async checkExists(email: string, username: string, socialId?: string): Promise<UserExistsCheck> {
    const emailQuery = `SELECT 1 FROM ${this.tableName} WHERE email = $1`;
    const usernameQuery = `SELECT 1 FROM ${this.tableName} WHERE username = $1`;
    
    const [emailResult, usernameResult] = await Promise.all([
      database.query(emailQuery, [email]),
      database.query(usernameQuery, [username])
    ]);

    let socialResult = { rowCount: 0 };
    if (socialId) {
      const socialQuery = `SELECT 1 FROM ${this.tableName} WHERE social_id = $1`;
      socialResult = await database.query(socialQuery, [socialId]);
    }

    return {
      email: emailResult.rowCount > 0,
      username: usernameResult.rowCount > 0,
      socialId: socialResult.rowCount > 0
    };
  }

  static async updateEmailVerificationToken(userId: string, token: string, expires: Date): Promise<void> {
    const query = `
      UPDATE ${this.tableName}
      SET email_verification_token = $1, 
          email_verification_expires = $2,
          updated_at = NOW()
      WHERE id = $3
    `;

    await database.query(query, [token, expires, parseInt(userId, 10)]);
  }

  static async verifyEmail(userId: string): Promise<void> {
    const query = `
      UPDATE ${this.tableName}
      SET email_verified = true,
          status = $1,
          email_verification_token = NULL,
          email_verification_expires = NULL,
          updated_at = NOW()
      WHERE id = $2
    `;

    await database.query(query, [UserStatus.ACTIVE, parseInt(userId, 10)]);
  }

  static async updatePasswordResetToken(userId: string, token: string, expires: Date): Promise<void> {
    const query = `
      UPDATE ${this.tableName}
      SET password_reset_token = $1,
          password_reset_expires = $2,
          updated_at = NOW()
      WHERE id = $3
    `;

    await database.query(query, [token, expires, parseInt(userId, 10)]);
  }

  static async clearPasswordResetToken(userId: string): Promise<void> {
    const query = `
      UPDATE ${this.tableName}
      SET password_reset_token = NULL,
          password_reset_expires = NULL,
          updated_at = NOW()
      WHERE id = $1
    `;

    await database.query(query, [parseInt(userId, 10)]);
  }

  static async updatePassword(userId: string, passwordHash: string): Promise<void> {
    const query = `
      UPDATE ${this.tableName}
      SET password_hash = $1,
          password_reset_token = NULL,
          password_reset_expires = NULL,
          updated_at = NOW()
      WHERE id = $2
    `;

    await database.query(query, [passwordHash, parseInt(userId, 10)]);
  }

  static async incrementLoginAttempts(userId: string): Promise<void> {
    const query = `
      UPDATE ${this.tableName}
      SET login_attempts = login_attempts + 1,
          updated_at = NOW()
      WHERE id = $1
    `;

    await database.query(query, [parseInt(userId, 10)]);
  }

  static async resetLoginAttempts(userId: string): Promise<void> {
    const query = `
      UPDATE ${this.tableName}
      SET login_attempts = 0,
          locked_until = NULL,
          updated_at = NOW()
      WHERE id = $1
    `;

    await database.query(query, [parseInt(userId, 10)]);
  }

  static async lockAccount(userId: string, lockUntil: Date): Promise<void> {
    const query = `
      UPDATE ${this.tableName}
      SET locked_until = $1,
          updated_at = NOW()
      WHERE id = $2
    `;

    await database.query(query, [lockUntil, parseInt(userId, 10)]);
  }

  static async updateLastLogin(userId: string): Promise<void> {
    const query = `
      UPDATE ${this.tableName}
      SET last_login_at = NOW(),
          login_attempts = 0,
          locked_until = NULL,
          updated_at = NOW()
      WHERE id = $1
    `;

    await database.query(query, [parseInt(userId, 10)]);
  }
}
