import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Types } from 'mongoose';
import { buildHiveLogger, AuthErrorFactory } from '../../shared';
import { getJWTConfig } from '../../config';
import type { TokenPair, TokenPayload, RefreshTokenPayload, TokenType } from '../types';
import { IUserDocument } from '../models';

export interface ITokenService {
  generateTokenPair(user: IUserDocument, sessionId: string, deviceId: string): Promise<TokenPair>;
  verifyAccessToken(token: string): Promise<TokenPayload>;
  verifyRefreshToken(token: string): Promise<RefreshTokenPayload>;
  generateEmailVerificationToken(userId: string, email: string): Promise<string>;
  generatePhoneVerificationCode(userId: string, phone: string): Promise<string>;
  generatePasswordResetToken(userId: string, email: string): Promise<string>;
  decodeTokenWithoutVerification(token: string): any;
  getTokenExpiration(token: string): Date | null;
  isTokenExpired(token: string): boolean;
  revokeToken(jti: string): Promise<void>;
  isTokenRevoked(jti: string): Promise<boolean>;
}

export interface ITokenCache {
  set(key: string, value: any, ttl: number): Promise<void>;
  get(key: string): Promise<any>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

export class TokenService implements ITokenService {
  private readonly jwtConfig = getJWTConfig();
  private readonly tokenCache: ITokenCache;
  private readonly logger = buildHiveLogger;
  private readonly tokenVersions = new Map<string, number>();

  constructor(tokenCache: ITokenCache) {
    this.tokenCache = tokenCache;
    this.logger.info('TokenService initialized', {
      service: 'TokenService',
      jwtAlgorithm: 'HS256',
      accessTokenExpiry: this.jwtConfig.expiresIn,
      refreshTokenExpiry: this.jwtConfig.refreshExpiresIn
    });
  }

  async generateTokenPair(user: IUserDocument, sessionId: string, deviceId: string): Promise<TokenPair> {
    try {
      this.logger.debug('Generating token pair', {
        userId: user.id,
        sessionId,
        deviceId,
        role: user.role
      });

      const jti = this.generateJTI();
      const refreshJti = this.generateJTI();
      const tokenVersion = this.getNextTokenVersion(user.id);

      const accessTokenPayload: TokenPayload = {
        userId: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status,
        verificationStatus: user.verificationStatus,
        platform: user.platform,
        sessionId,
        deviceId,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + this.parseExpiration(this.jwtConfig.expiresIn),
        jti
      };

      const refreshTokenPayload: RefreshTokenPayload = {
        userId: user.id,
        sessionId,
        deviceId,
        tokenVersion,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + this.parseExpiration(this.jwtConfig.refreshExpiresIn)
      };

      const accessToken = jwt.sign(accessTokenPayload, this.jwtConfig.secret, {
        algorithm: 'HS256',
        expiresIn: this.jwtConfig.expiresIn,
        issuer: 'buildhive-auth',
        audience: 'buildhive-api'
      });

      const refreshToken = jwt.sign(refreshTokenPayload, this.jwtConfig.refreshSecret, {
        algorithm: 'HS256',
        expiresIn: this.jwtConfig.refreshExpiresIn,
        issuer: 'buildhive-auth',
        audience: 'buildhive-refresh',
        jwtid: refreshJti
      });

      await this.cacheTokenMetadata(jti, {
        userId: user.id,
        sessionId,
        deviceId,
        type: 'access',
        issuedAt: new Date(),
        expiresAt: new Date(accessTokenPayload.exp * 1000)
      });

      await this.cacheTokenMetadata(refreshJti, {
        userId: user.id,
        sessionId,
        deviceId,
        type: 'refresh',
        tokenVersion,
        issuedAt: new Date(),
        expiresAt: new Date(refreshTokenPayload.exp * 1000)
      });

      const tokenPair: TokenPair = {
        accessToken,
        refreshToken,
        expiresIn: this.parseExpiration(this.jwtConfig.expiresIn),
        refreshExpiresIn: this.parseExpiration(this.jwtConfig.refreshExpiresIn),
        tokenType: 'Bearer'
      };

      this.logger.debug('Token pair generated successfully', {
        userId: user.id,
        sessionId,
        accessTokenJti: jti,
        refreshTokenJti: refreshJti,
        tokenVersion
      });

      return tokenPair;

    } catch (error) {
      this.logger.error('Failed to generate token pair', error, {
        userId: user.id,
        sessionId,
        deviceId
      });

      throw AuthErrorFactory.tokenGenerationFailed('Failed to generate authentication tokens', error);
    }
  }

  async verifyAccessToken(token: string): Promise<TokenPayload> {
    try {
      if (!token) {
        throw AuthErrorFactory.invalidToken('Access token is required');
      }

      const cleanToken = this.cleanToken(token);
      
      const decoded = jwt.verify(cleanToken, this.jwtConfig.secret, {
        algorithms: ['HS256'],
        issuer: 'buildhive-auth',
        audience: 'buildhive-api'
      }) as TokenPayload;

      if (!decoded.jti) {
        throw AuthErrorFactory.invalidToken('Token missing JTI');
      }

      const isRevoked = await this.isTokenRevoked(decoded.jti);
      if (isRevoked) {
        throw AuthErrorFactory.invalidToken('Token has been revoked');
      }

      await this.validateTokenClaims(decoded);

      this.logger.debug('Access token verified successfully', {
        userId: decoded.userId,
        sessionId: decoded.sessionId,
        jti: decoded.jti
      });

      return decoded;

    } catch (error) {
      this.logger.warn('Access token verification failed', {
        error: error.message,
        tokenPrefix: token ? token.substring(0, 20) + '...' : 'null'
      });

      if (error.name === 'TokenExpiredError') {
        throw AuthErrorFactory.tokenExpired();
      }

      if (error.name === 'JsonWebTokenError') {
        throw AuthErrorFactory.invalidToken('Malformed token');
      }

      if (error instanceof Error && error.name === 'BuildHiveAuthError') {
        throw error;
      }

      throw AuthErrorFactory.invalidToken('Token verification failed');
    }
  }

  async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    try {
      if (!token) {
        throw AuthErrorFactory.invalidToken('Refresh token is required');
      }

      const decoded = jwt.verify(token, this.jwtConfig.refreshSecret, {
        algorithms: ['HS256'],
        issuer: 'buildhive-auth',
        audience: 'buildhive-refresh'
      }) as RefreshTokenPayload;

      const currentTokenVersion = this.tokenVersions.get(decoded.userId) || 0;
      if (decoded.tokenVersion < currentTokenVersion) {
        throw AuthErrorFactory.invalidToken('Token version is outdated');
      }

      this.logger.debug('Refresh token verified successfully', {
        userId: decoded.userId,
        sessionId: decoded.sessionId,
        tokenVersion: decoded.tokenVersion
      });

      return decoded;

    } catch (error) {
      this.logger.warn('Refresh token verification failed', {
        error: error.message,
        tokenPrefix: token ? token.substring(0, 20) + '...' : 'null'
      });

      if (error.name === 'TokenExpiredError') {
        throw AuthErrorFactory.tokenExpired();
      }

      if (error.name === 'JsonWebTokenError') {
        throw AuthErrorFactory.invalidToken('Malformed refresh token');
      }

      throw AuthErrorFactory.invalidToken('Refresh token verification failed');
    }
  }

  async generateEmailVerificationToken(userId: string, email: string): Promise<string> {
    try {
      this.logger.debug('Generating email verification token', {
        userId,
        email: this.maskEmail(email)
      });

      const payload = {
        userId,
        email,
        type: 'email_verification' as TokenType,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
      };

      const token = jwt.sign(payload, this.jwtConfig.secret, {
        algorithm: 'HS256',
        issuer: 'buildhive-auth',
        audience: 'buildhive-verification'
      });

      await this.cacheVerificationToken(userId, 'email', token, 24 * 60 * 60);

      this.logger.debug('Email verification token generated', {
        userId,
        email: this.maskEmail(email),
        expiresIn: '24h'
      });

      return token;

    } catch (error) {
      this.logger.error('Failed to generate email verification token', error, {
        userId,
        email: this.maskEmail(email)
      });

      throw AuthErrorFactory.tokenGenerationFailed('Failed to generate email verification token', error);
    }
  }

  async generatePhoneVerificationCode(userId: string, phone: string): Promise<string> {
    try {
      this.logger.debug('Generating phone verification code', {
        userId,
        phone: this.maskPhone(phone)
      });

      const code = this.generateNumericCode(6);
      const hashedCode = crypto.createHash('sha256').update(code).digest('hex');

      const payload = {
        userId,
        phone,
        hashedCode,
        type: 'phone_verification' as TokenType,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (10 * 60) // 10 minutes
      };

      const token = jwt.sign(payload, this.jwtConfig.secret, {
        algorithm: 'HS256',
        issuer: 'buildhive-auth',
        audience: 'buildhive-verification'
      });

      await this.cacheVerificationToken(userId, 'phone', token, 10 * 60);
      await this.cacheVerificationCode(userId, hashedCode, 10 * 60);

      this.logger.debug('Phone verification code generated', {
        userId,
        phone: this.maskPhone(phone),
        expiresIn: '10m'
      });

      return code;

    } catch (error) {
      this.logger.error('Failed to generate phone verification code', error, {
        userId,
        phone: this.maskPhone(phone)
      });

      throw AuthErrorFactory.tokenGenerationFailed('Failed to generate phone verification code', error);
    }
  }

  async generatePasswordResetToken(userId: string, email: string): Promise<string> {
    try {
      this.logger.debug('Generating password reset token', {
        userId,
        email: this.maskEmail(email)
      });

      const payload = {
        userId,
        email,
        type: 'password_reset' as TokenType,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (10 * 60) // 10 minutes
      };

      const token = jwt.sign(payload, this.jwtConfig.secret, {
        algorithm: 'HS256',
        issuer: 'buildhive-auth',
        audience: 'buildhive-reset'
      });

      await this.cacheVerificationToken(userId, 'password_reset', token, 10 * 60);

      this.logger.debug('Password reset token generated', {
        userId,
        email: this.maskEmail(email),
        expiresIn: '10m'
      });

      return token;

    } catch (error) {
      this.logger.error('Failed to generate password reset token', error, {
        userId,
        email: this.maskEmail(email)
      });

      throw AuthErrorFactory.tokenGenerationFailed('Failed to generate password reset token', error);
    }
  }

  decodeTokenWithoutVerification(token: string): any {
    try {
      const cleanToken = this.cleanToken(token);
      return jwt.decode(cleanToken);
    } catch (error) {
      this.logger.warn('Failed to decode token', { error: error.message });
      return null;
    }
  }

  getTokenExpiration(token: string): Date | null {
    try {
      const decoded = this.decodeTokenWithoutVerification(token);
      return decoded?.exp ? new Date(decoded.exp * 1000) : null;
    } catch (error) {
      return null;
    }
  }

  isTokenExpired(token: string): boolean {
    const expiration = this.getTokenExpiration(token);
    return expiration ? expiration < new Date() : true;
  }

  async revokeToken(jti: string): Promise<void> {
    try {
      this.logger.debug('Revoking token', { jti });

      const cacheKey = `revoked_token:${jti}`;
      await this.tokenCache.set(cacheKey, true, 24 * 60 * 60); // Cache for 24 hours

      this.logger.debug('Token revoked successfully', { jti });

    } catch (error) {
      this.logger.error('Failed to revoke token', error, { jti });
      throw AuthErrorFactory.tokenRevocationFailed('Failed to revoke token', error);
    }
  }

  async isTokenRevoked(jti: string): Promise<boolean> {
    try {
      const cacheKey = `revoked_token:${jti}`;
      const isRevoked = await this.tokenCache.exists(cacheKey);
      
      this.logger.debug('Token revocation status checked', { jti, isRevoked });
      
      return isRevoked;

    } catch (error) {
      this.logger.warn('Failed to check token revocation status', error, { jti });
      return false; // Fail open for availability
    }
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    try {
      this.logger.debug('Revoking all user tokens', { userId });

      const currentVersion = this.tokenVersions.get(userId) || 0;
      this.tokenVersions.set(userId, currentVersion + 1);

      const cacheKey = `user_token_version:${userId}`;
      await this.tokenCache.set(cacheKey, currentVersion + 1, 30 * 24 * 60 * 60); // 30 days

      this.logger.info('All user tokens revoked', { 
        userId, 
        newTokenVersion: currentVersion + 1 
      });

    } catch (error) {
      this.logger.error('Failed to revoke all user tokens', error, { userId });
      throw AuthErrorFactory.tokenRevocationFailed('Failed to revoke all user tokens', error);
    }
  }

  async validateTokenClaims(payload: TokenPayload): Promise<void> {
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp <= now) {
      throw AuthErrorFactory.tokenExpired();
    }

    if (payload.iat > now + 60) { // Allow 60 seconds clock skew
      throw AuthErrorFactory.invalidToken('Token issued in the future');
    }

    if (!payload.userId || !payload.sessionId || !payload.deviceId) {
      throw AuthErrorFactory.invalidToken('Token missing required claims');
    }

    if (!Object.values(['client', 'tradie', 'enterprise']).includes(payload.role)) {
      throw AuthErrorFactory.invalidToken('Invalid role in token');
    }

    if (!Object.values(['active', 'inactive', 'suspended', 'pending_verification']).includes(payload.status)) {
      throw AuthErrorFactory.invalidToken('Invalid status in token');
    }
  }

  async refreshTokenVersion(userId: string): Promise<number> {
    try {
      const currentVersion = this.tokenVersions.get(userId) || 0;
      const newVersion = currentVersion + 1;
      
      this.tokenVersions.set(userId, newVersion);
      
      const cacheKey = `user_token_version:${userId}`;
      await this.tokenCache.set(cacheKey, newVersion, 30 * 24 * 60 * 60);

      this.logger.debug('Token version refreshed', { userId, newVersion });
      
      return newVersion;

    } catch (error) {
      this.logger.error('Failed to refresh token version', error, { userId });
      throw AuthErrorFactory.tokenGenerationFailed('Failed to refresh token version', error);
    }
  }

  async getTokenVersion(userId: string): Promise<number> {
    try {
      let version = this.tokenVersions.get(userId);
      
      if (version === undefined) {
        const cacheKey = `user_token_version:${userId}`;
        version = await this.tokenCache.get(cacheKey) || 0;
        this.tokenVersions.set(userId, version);
      }

      return version;

    } catch (error) {
      this.logger.warn('Failed to get token version', error, { userId });
      return 0;
    }
  }

  private generateJTI(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private generateNumericCode(length: number): string {
    const digits = '0123456789';
    let code = '';
    
    for (let i = 0; i < length; i++) {
      code += digits[crypto.randomInt(0, digits.length)];
    }
    
    return code;
  }

  private getNextTokenVersion(userId: string): number {
    const currentVersion = this.tokenVersions.get(userId) || 0;
    const nextVersion = currentVersion + 1;
    this.tokenVersions.set(userId, nextVersion);
    return nextVersion;
  }

  private parseExpiration(expiration: string): number {
    const units: Record<string, number> = {
      's': 1,
      'm': 60,
      'h': 3600,
      'd': 86400,
      'w': 604800
    };

    const match = expiration.match(/^(\d+)([smhdw])$/);
    if (!match) {
      throw new Error(`Invalid expiration format: ${expiration}`);
    }

    const [, value, unit] = match;
    return parseInt(value, 10) * units[unit];
  }

  private cleanToken(token: string): string {
    return token.replace(/^Bearer\s+/i, '').trim();
  }

  private async cacheTokenMetadata(jti: string, metadata: any): Promise<void> {
    try {
      const cacheKey = `token_metadata:${jti}`;
      const ttl = Math.floor((metadata.expiresAt.getTime() - Date.now()) / 1000);
      
      if (ttl > 0) {
        await this.tokenCache.set(cacheKey, metadata, ttl);
      }

    } catch (error) {
      this.logger.warn('Failed to cache token metadata', error, { jti });
    }
  }

  private async cacheVerificationToken(userId: string, type: string, token: string, ttl: number): Promise<void> {
    try {
      const cacheKey = `verification_token:${userId}:${type}`;
      await this.tokenCache.set(cacheKey, token, ttl);

    } catch (error) {
      this.logger.warn('Failed to cache verification token', error, { userId, type });
    }
  }

  private async cacheVerificationCode(userId: string, hashedCode: string, ttl: number): Promise<void> {
    try {
      const cacheKey = `verification_code:${userId}`;
      await this.tokenCache.set(cacheKey, hashedCode, ttl);

    } catch (error) {
      this.logger.warn('Failed to cache verification code', error, { userId });
    }
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    return `${local.substring(0, 2)}***@${domain}`;
  }

  private maskPhone(phone: string): string {
    return phone.substring(0, 4) + '***' + phone.substring(phone.length - 2);
  }

  async getTokenMetadata(jti: string): Promise<any> {
    try {
      const cacheKey = `token_metadata:${jti}`;
      return await this.tokenCache.get(cacheKey);

    } catch (error) {
      this.logger.warn('Failed to get token metadata', error, { jti });
      return null;
    }
  }

  async invalidateVerificationToken(userId: string, type: string): Promise<void> {
    try {
      const cacheKey = `verification_token:${userId}:${type}`;
      await this.tokenCache.delete(cacheKey);

      this.logger.debug('Verification token invalidated', { userId, type });

    } catch (error) {
      this.logger.warn('Failed to invalidate verification token', error, { userId, type });
    }
  }

  async getVerificationToken(userId: string, type: string): Promise<string | null> {
    try {
      const cacheKey = `verification_token:${userId}:${type}`;
      return await this.tokenCache.get(cacheKey);

    } catch (error) {
      this.logger.warn('Failed to get verification token', error, { userId, type });
      return null;
    }
  }

  async validateVerificationCode(userId: string, code: string): Promise<boolean> {
    try {
      const hashedCode = crypto.createHash('sha256').update(code).digest('hex');
      const cacheKey = `verification_code:${userId}`;
      const storedHash = await this.tokenCache.get(cacheKey);

      const isValid = storedHash === hashedCode;

      if (isValid) {
        await this.tokenCache.delete(cacheKey);
      }

      this.logger.debug('Verification code validated', { userId, isValid });

      return isValid;

    } catch (error) {
      this.logger.warn('Failed to validate verification code', error, { userId });
      return false;
    }
  }

  async cleanupExpiredTokens(): Promise<number> {
    try {
      this.logger.debug('Starting expired token cleanup');

      let cleanedCount = 0;
      const now = Date.now();

      for (const [userId, version] of this.tokenVersions.entries()) {
        try {
          const cacheKey = `user_token_version:${userId}`;
          const cachedVersion = await this.tokenCache.get(cacheKey);
          
          if (cachedVersion === null) {
            this.tokenVersions.delete(userId);
            cleanedCount++;
          }
        } catch (error) {
          this.logger.warn('Failed to check token version cache', error, { userId });
        }
      }

      this.logger.info('Expired token cleanup completed', { cleanedCount });

      return cleanedCount;

    } catch (error) {
      this.logger.error('Failed to cleanup expired tokens', error);
      return 0;
    }
  }

  async getTokenStatistics(): Promise<{
    totalActiveTokens: number;
    tokensByType: Record<string, number>;
    averageTokenAge: number;
  }> {
    try {
      const stats = {
        totalActiveTokens: this.tokenVersions.size,
        tokensByType: {
          access: 0,
          refresh: 0,
          verification: 0
        },
        averageTokenAge: 0
      };

      this.logger.debug('Token statistics retrieved', stats);

      return stats;

    } catch (error) {
      this.logger.error('Failed to get token statistics', error);
      return {
        totalActiveTokens: 0,
        tokensByType: { access: 0, refresh: 0, verification: 0 },
        averageTokenAge: 0
      };
    }
  }
}
