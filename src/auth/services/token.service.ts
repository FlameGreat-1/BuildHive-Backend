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
    
    // TEMPORARILY DISABLED - SESSION CREATION
    // const expiresAt = new Date();
    // expiresAt.setHours(expiresAt.getHours() + 24);
    // await this.sessionRepository.createSession({
    //   userId,
    //   token,
    //   type: AUTH_CONSTANTS.TOKEN_TYPES.ACCESS,
    //   expiresAt
    // });

    return token;
  }

  async generateEmailVerificationToken(userId: string, email: string): Promise<string> {
    const token = generateEmailVerificationToken(userId, email);
    
    // TEMPORARILY DISABLED - SESSION CREATION
    // const expiresAt = new Date();
    // expiresAt.setHours(expiresAt.getHours() + 24);
    // await this.sessionRepository.createSession({
    //   userId,
    //   token,
    //   type: AUTH_CONSTANTS.TOKEN_TYPES.EMAIL_VERIFICATION,
    //   expiresAt
    // });

    const cacheKey = `email_verification:${userId}`;
    try {
      await this.redisClient.setex(cacheKey, 24 * 60 * 60, token);
    } catch (redisError) {
      console.log('Redis unavailable, continuing without cache');
    }

    return token;
  }

  async verifyEmailVerificationToken(token: string): Promise<{ userId: string; email: string }> {
    try {
      const decoded = verifyEmailVerificationToken(token);
      
      // TEMPORARILY DISABLED - SESSION VALIDATION
      // const session = await this.sessionRepository.findSessionByToken(token);
      // if (!session || session.type !== AUTH_CONSTANTS.TOKEN_TYPES.EMAIL_VERIFICATION) {
      //   throw new AppError(
      //     'Invalid verification token',
      //     HTTP_STATUS_CODES.BAD_REQUEST,
      //     ERROR_CODES.INVALID_TOKEN
      //   );
      // }

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
    // TEMPORARILY DISABLED - SESSION CLEANUP
    // const sessions = await this.sessionRepository.findSessionsByUserId(
    //   userId, 
    //   AUTH_CONSTANTS.TOKEN_TYPES.EMAIL_VERIFICATION
    // );
    // for (const session of sessions) {
    //   await this.sessionRepository.deleteSession(session.token);
    // }

    const cacheKey = `email_verification:${userId}`;
    try {
      await this.redisClient.del(cacheKey);
    } catch (redisError) {
      console.log('Redis unavailable, continuing without cache cleanup');
    }
  }

  async validateAccessToken(token: string): Promise<boolean> {
    try {
      // TEMPORARILY DISABLED - SESSION VALIDATION
      // const session = await this.sessionRepository.findSessionByToken(token);
      // return session !== null && session.type === AUTH_CONSTANTS.TOKEN_TYPES.ACCESS;
      return false;
    } catch (error) {
      return false;
    }
  }

  async revokeToken(token: string): Promise<void> {
    // TEMPORARILY DISABLED - SESSION REVOCATION
    // await this.sessionRepository.deleteSession(token);
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    // TEMPORARILY DISABLED - SESSION CLEANUP
    // await this.sessionRepository.deleteUserSessions(userId);
    
    const cacheKey = `email_verification:${userId}`;
    try {
      await this.redisClient.del(cacheKey);
    } catch (redisError) {
      console.log('Redis unavailable, continuing without cache cleanup');
    }
  }

  async cleanupExpiredTokens(): Promise<number> {
    // TEMPORARILY DISABLED - SESSION CLEANUP
    // return await this.sessionRepository.cleanupExpiredSessions();
    return 0;
  }

  async getTokenInfo(token: string): Promise<{
    userId: string;
    type: string;
    expiresAt: Date;
    isValid: boolean;
  } | null> {
    // TEMPORARILY DISABLED - SESSION INFO
    // const session = await this.sessionRepository.findSessionByToken(token);
    // if (!session) {
    //   return null;
    // }
    // return {
    //   userId: session.userId,
    //   type: session.type,
    //   expiresAt: session.expiresAt,
    //   isValid: session.expiresAt > new Date()
    // };
    return null;
  }

  async extendTokenExpiry(token: string, hours: number = 24): Promise<void> {
    // TEMPORARILY DISABLED - SESSION EXPIRY UPDATE
    // const expiresAt = new Date();
    // expiresAt.setHours(expiresAt.getHours() + hours);
    // await this.sessionRepository.updateSessionExpiry(token, expiresAt);
  }

  async isTokenBlacklisted(token: string): Promise<boolean> {
    const blacklistKey = `blacklist:${token}`;
    try {
      const result = await this.redisClient.get(blacklistKey);
      return result !== null;
    } catch (redisError) {
      return false;
    }
  }

  async blacklistToken(token: string, expiryHours: number = 24): Promise<void> {
    const blacklistKey = `blacklist:${token}`;
    try {
      await this.redisClient.setex(blacklistKey, expiryHours * 60 * 60, 'true');
    } catch (redisError) {
      console.log('Redis unavailable, continuing without blacklist');
    }
  }
}
