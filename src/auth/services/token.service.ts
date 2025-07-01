import { SessionRepository } from '../repositories';
import { generateAccessToken, generateEmailVerificationToken, verifyEmailVerificationToken } from '../utils';
import { UserRole } from '../../shared/types';
import { AUTH_CONSTANTS } from '../../config/auth';
import { AppError } from '../../shared/utils';
import { HTTP_STATUS_CODES, ERROR_CODES } from '../../config/auth';
import { database } from '../../shared/database';

export class TokenService {
  private sessionRepository: SessionRepository;
  private redisClient: any;

  constructor() {
    this.sessionRepository = new SessionRepository();
    this.redisClient = database.getRedisClient();
  }

  async generateAccessToken(userId: string, email: string, role: UserRole): Promise<string> {
    const token = generateAccessToken(userId, email, role);
    
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await this.sessionRepository.createSession({
      userId,
      token,
      type: AUTH_CONSTANTS.TOKEN_TYPES.ACCESS,
      expiresAt
    });

    return token;
  }

  async generateEmailVerificationToken(userId: string, email: string): Promise<string> {
    const token = generateEmailVerificationToken(userId, email);
    
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await this.sessionRepository.createSession({
      userId,
      token,
      type: AUTH_CONSTANTS.TOKEN_TYPES.EMAIL_VERIFICATION,
      expiresAt
    });

    const cacheKey = `email_verification:${userId}`;
    await this.redisClient.setex(cacheKey, 24 * 60 * 60, token);

    return token;
  }

  async verifyEmailVerificationToken(token: string): Promise<{ userId: string; email: string }> {
    try {
      const decoded = verifyEmailVerificationToken(token);
      
      const session = await this.sessionRepository.findSessionByToken(token);
      if (!session || session.type !== AUTH_CONSTANTS.TOKEN_TYPES.EMAIL_VERIFICATION) {
        throw new AppError(
          'Invalid verification token',
          HTTP_STATUS_CODES.BAD_REQUEST,
          ERROR_CODES.INVALID_TOKEN
        );
      }

      return decoded;
    } catch (error: any) {
      throw new AppError(
        'Invalid or expired verification token',
        HTTP_STATUS_CODES.BAD_REQUEST,
        ERROR_CODES.INVALID_TOKEN
      );
    }
  }

  async invalidateEmailVerificationToken(userId: string): Promise<void> {
    const sessions = await this.sessionRepository.findSessionsByUserId(
      userId, 
      AUTH_CONSTANTS.TOKEN_TYPES.EMAIL_VERIFICATION
    );

    for (const session of sessions) {
      await this.sessionRepository.deleteSession(session.token);
    }

    const cacheKey = `email_verification:${userId}`;
    await this.redisClient.del(cacheKey);
  }

  async validateAccessToken(token: string): Promise<boolean> {
    try {
      const session = await this.sessionRepository.findSessionByToken(token);
      return session !== null && session.type === AUTH_CONSTANTS.TOKEN_TYPES.ACCESS;
    } catch (error) {
      return false;
    }
  }

  async revokeToken(token: string): Promise<void> {
    await this.sessionRepository.deleteSession(token);
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.sessionRepository.deleteUserSessions(userId);
    
    const cacheKey = `email_verification:${userId}`;
    await this.redisClient.del(cacheKey);
  }

  async cleanupExpiredTokens(): Promise<number> {
    return await this.sessionRepository.cleanupExpiredSessions();
  }

  async getTokenInfo(token: string): Promise<{
    userId: string;
    type: string;
    expiresAt: Date;
    isValid: boolean;
  } | null> {
    const session = await this.sessionRepository.findSessionByToken(token);
    if (!session) {
      return null;
    }

    return {
      userId: session.userId,
      type: session.type,
      expiresAt: session.expiresAt,
      isValid: session.expiresAt > new Date()
    };
  }

  async extendTokenExpiry(token: string, hours: number = 24): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + hours);
    
    await this.sessionRepository.updateSessionExpiry(token, expiresAt);
  }

  async isTokenBlacklisted(token: string): Promise<boolean> {
    const blacklistKey = `blacklist:${token}`;
    const result = await this.redisClient.get(blacklistKey);
    return result !== null;
  }

  async blacklistToken(token: string, expiryHours: number = 24): Promise<void> {
    const blacklistKey = `blacklist:${token}`;
    await this.redisClient.setex(blacklistKey, expiryHours * 60 * 60, 'true');
  }
}
