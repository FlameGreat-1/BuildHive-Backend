import { SessionRepository } from '../repositories';
import { generateAccessToken, generateRefreshToken, generatePasswordResetToken, generateEmailVerificationToken, verifyToken, verifyRefreshToken, verifyPasswordResetToken, verifyEmailVerificationToken, generateTokenId } from '../utils';
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

  async generateRefreshToken(userId: string, email: string, role: UserRole): Promise<string> {
    const tokenId = generateTokenId();
    const token = generateRefreshToken(userId, email, role, tokenId);
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await this.sessionRepository.createSession({
      userId,
      token,
      type: AUTH_CONSTANTS.TOKEN_TYPES.REFRESH,
      expiresAt
    });

    return token;
  }

  async generatePasswordResetToken(userId: string, email: string): Promise<string> {
    const token = generatePasswordResetToken(userId, email);
    
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + AUTH_CONSTANTS.PASSWORD_RESET.TOKEN_EXPIRES_MINUTES);
    await this.sessionRepository.createSession({
      userId,
      token,
      type: AUTH_CONSTANTS.TOKEN_TYPES.PASSWORD_RESET,
      expiresAt
    });

    const cacheKey = `password_reset:${userId}`;
    try {
      await this.redisClient.setex(cacheKey, AUTH_CONSTANTS.PASSWORD_RESET.TOKEN_EXPIRES_MINUTES * 60, token);
    } catch (redisError) {
      console.log('Redis unavailable, continuing without cache');
    }

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
    try {
      await this.redisClient.setex(cacheKey, 24 * 60 * 60, token);
    } catch (redisError) {
      console.log('Redis unavailable, continuing without cache');
    }

    return token;
  }

  async verifyAccessToken(token: string): Promise<{ userId: string; email: string; role: UserRole }> {
    try {
      const decoded = verifyToken(token);
      
      const session = await this.sessionRepository.findSessionByToken(token);
      if (!session || session.type !== AUTH_CONSTANTS.TOKEN_TYPES.ACCESS) {
        throw new AppError(
          'Invalid access token',
          HTTP_STATUS_CODES.UNAUTHORIZED,
          ERROR_CODES.INVALID_TOKEN
        );
      }

      return {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role
      };
    } catch (error: any) {
      throw new AppError(
        'Invalid or expired access token',
        HTTP_STATUS_CODES.UNAUTHORIZED,
        ERROR_CODES.INVALID_TOKEN
      );
    }
  }

  async verifyRefreshToken(token: string): Promise<{ userId: string; email: string; role: UserRole; tokenId: string }> {
    try {
      const decoded = verifyRefreshToken(token);
      
      const session = await this.sessionRepository.findSessionByToken(token);
      if (!session || session.type !== AUTH_CONSTANTS.TOKEN_TYPES.REFRESH) {
        throw new AppError(
          'Invalid refresh token',
          HTTP_STATUS_CODES.UNAUTHORIZED,
          ERROR_CODES.INVALID_TOKEN
        );
      }

      return {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        tokenId: decoded.tokenId
      };
    } catch (error: any) {
      throw new AppError(
        'Invalid or expired refresh token',
        HTTP_STATUS_CODES.UNAUTHORIZED,
        ERROR_CODES.INVALID_TOKEN
      );
    }
  }

  async verifyPasswordResetToken(token: string): Promise<{ userId: string; email: string }> {
    try {
      const decoded = verifyPasswordResetToken(token);
      
      const session = await this.sessionRepository.findSessionByToken(token);
      if (!session || session.type !== AUTH_CONSTANTS.TOKEN_TYPES.PASSWORD_RESET) {
        throw new AppError(
          'Invalid password reset token',
          HTTP_STATUS_CODES.BAD_REQUEST,
          ERROR_CODES.INVALID_TOKEN
        );
      }

      return {
        userId: decoded.userId,
        email: decoded.email
      };
    } catch (error: any) {
      throw new AppError(
        'Invalid or expired password reset token',
        HTTP_STATUS_CODES.BAD_REQUEST,
        ERROR_CODES.INVALID_TOKEN
      );
    }
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

  async rotateRefreshToken(oldToken: string, userId: string, email: string, role: UserRole): Promise<string> {
    await this.revokeToken(oldToken);
    return await this.generateRefreshToken(userId, email, role);
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
    try {
      await this.redisClient.del(cacheKey);
    } catch (redisError) {
      console.log('Redis unavailable, continuing without cache cleanup');
    }
  }

  async invalidatePasswordResetToken(userId: string): Promise<void> {
    const sessions = await this.sessionRepository.findSessionsByUserId(
      userId, 
      AUTH_CONSTANTS.TOKEN_TYPES.PASSWORD_RESET
    );
    for (const session of sessions) {
      await this.sessionRepository.deleteSession(session.token);
    }

    const cacheKey = `password_reset:${userId}`;
    try {
      await this.redisClient.del(cacheKey);
    } catch (redisError) {
      console.log('Redis unavailable, continuing without cache cleanup');
    }
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
    await this.blacklistToken(token);
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    const sessions = await this.sessionRepository.findSessionsByUserId(userId);
    for (const session of sessions) {
      await this.blacklistToken(session.token);
    }
    
    await this.sessionRepository.deleteUserSessions(userId);
    
    const emailCacheKey = `email_verification:${userId}`;
    const passwordCacheKey = `password_reset:${userId}`;
    try {
      await this.redisClient.del(emailCacheKey);
      await this.redisClient.del(passwordCacheKey);
    } catch (redisError) {
      console.log('Redis unavailable, continuing without cache cleanup');
    }
  }

  async revokeUserTokensByType(userId: string, type: string): Promise<void> {
    const sessions = await this.sessionRepository.findSessionsByUserId(userId, type);
    for (const session of sessions) {
      await this.blacklistToken(session.token);
    }
    
    await this.sessionRepository.deleteUserSessions(userId, type);
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

  async generateTokenPair(userId: string, email: string, role: UserRole): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    const accessToken = await this.generateAccessToken(userId, email, role);
    const refreshToken = await this.generateRefreshToken(userId, email, role);
    
    return {
      accessToken,
      refreshToken,
      expiresIn: 24 * 60 * 60
    };
  }
}
