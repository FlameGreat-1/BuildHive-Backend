// src/config/auth.ts

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { logger, createLogContext } from '@/utils/logger';
import { SECURITY_CONSTANTS, ERROR_CODES, CACHE_CONSTANTS } from '@/utils/constants';
import { JWTPayload, UserType, UserStatus } from '@/types/auth.types';
import { ApiError, ErrorSeverity } from '@/types/common.types';
import { setCache, getCache, deleteCache } from './redis';

// Enterprise authentication configuration interface
interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  refreshTokenExpiresIn: string;
  bcryptRounds: number;
  maxLoginAttempts: number;
  lockoutDuration: number;
  passwordResetExpiry: number;
  verificationCodeExpiry: number;
  sessionTimeout: number;
  maxConcurrentSessions: number;
}

// Enterprise JWT token pair interface
interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

// Enterprise password validation result
interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'medium' | 'strong';
  score: number;
}

// Enterprise authentication manager
class AuthManager {
  private static instance: AuthManager;
  private config: AuthConfig;

  private constructor() {
    this.config = this.loadConfiguration();
    this.validateConfiguration();
  }

  // Singleton pattern for enterprise auth management
  public static getInstance(): AuthManager {
    if (!AuthManager.instance) {
      AuthManager.instance = new AuthManager();
    }
    return AuthManager.instance;
  }

  // Load authentication configuration with enterprise defaults
  private loadConfiguration(): AuthConfig {
    return {
      jwtSecret: process.env.JWT_SECRET || this.generateSecureSecret(),
      jwtExpiresIn: process.env.JWT_EXPIRES_IN || SECURITY_CONSTANTS.JWT.ACCESS_TOKEN_EXPIRES,
      refreshTokenExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || SECURITY_CONSTANTS.JWT.REFRESH_TOKEN_EXPIRES,
      bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || String(SECURITY_CONSTANTS.PASSWORD.BCRYPT_ROUNDS)),
      maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5'),
      lockoutDuration: parseInt(process.env.LOCKOUT_DURATION || String(15 * 60 * 1000)), // 15 minutes
      passwordResetExpiry: parseInt(process.env.PASSWORD_RESET_EXPIRY || String(60 * 60 * 1000)), // 1 hour
      verificationCodeExpiry: parseInt(process.env.VERIFICATION_CODE_EXPIRY || String(10 * 60 * 1000)), // 10 minutes
      sessionTimeout: parseInt(process.env.SESSION_TIMEOUT || String(SECURITY_CONSTANTS.SESSION.IDLE_TIMEOUT)),
      maxConcurrentSessions: parseInt(process.env.MAX_CONCURRENT_SESSIONS || String(SECURITY_CONSTANTS.SESSION.MAX_CONCURRENT_SESSIONS)),
    };
  }

  // Generate secure secret for JWT if not provided
  private generateSecureSecret(): string {
    const crypto = require('crypto');
    const secret = crypto.randomBytes(64).toString('hex');
    
    logger.warn('JWT_SECRET not provided, generated temporary secret', 
      createLogContext()
        .withMetadata({ 
          warning: 'Use environment variable JWT_SECRET in production',
          secretLength: secret.length 
        })
        .build()
    );
    
    return secret;
  }

  // Enterprise configuration validation
  private validateConfiguration(): void {
    const errors: string[] = [];

    if (!this.config.jwtSecret || this.config.jwtSecret.length < 32) {
      errors.push('JWT secret must be at least 32 characters long');
    }

    if (this.config.bcryptRounds < 10 || this.config.bcryptRounds > 15) {
      errors.push('Bcrypt rounds must be between 10 and 15');
    }

    if (this.config.maxLoginAttempts < 3 || this.config.maxLoginAttempts > 10) {
      errors.push('Max login attempts must be between 3 and 10');
    }

    if (errors.length > 0) {
      const errorMessage = `Authentication configuration validation failed: ${errors.join(', ')}`;
      logger.error(errorMessage, 
        createLogContext()
          .withError(ERROR_CODES.SYS_CONFIGURATION_ERROR)
          .withMetadata({ errors })
          .build()
      );
      throw new Error(errorMessage);
    }

    logger.info('Authentication configuration validated successfully', 
      createLogContext()
        .withMetadata({
          bcryptRounds: this.config.bcryptRounds,
          maxLoginAttempts: this.config.maxLoginAttempts,
          sessionTimeout: this.config.sessionTimeout,
        })
        .build()
    );
  }

  // Enterprise password hashing with timing attack protection
  public async hashPassword(password: string): Promise<string> {
    const startTime = Date.now();
    
    try {
      // Validate password before hashing
      const validation = this.validatePassword(password);
      if (!validation.isValid) {
        throw new Error(`Password validation failed: ${validation.errors.join(', ')}`);
      }

      const hashedPassword = await bcrypt.hash(password, this.config.bcryptRounds);
      
      const duration = Date.now() - startTime;
      logger.debug('Password hashed successfully', 
        createLogContext()
          .withMetadata({ 
            duration,
            bcryptRounds: this.config.bcryptRounds,
            passwordStrength: validation.strength 
          })
          .build()
      );

      return hashedPassword;

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Password hashing failed', 
        createLogContext()
          .withError(ERROR_CODES.SYS_INTERNAL_SERVER_ERROR)
          .withMetadata({ 
            duration,
            errorMessage: error instanceof Error ? error.message : 'Unknown error' 
          })
          .build()
      );
      throw error;
    }
  }

  // Enterprise password verification with timing attack protection
  public async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      const isValid = await bcrypt.compare(password, hashedPassword);
      
      const duration = Date.now() - startTime;
      logger.debug('Password verification completed', 
        createLogContext()
          .withMetadata({ 
            duration,
            isValid,
            timing: 'constant_time_operation' 
          })
          .build()
      );

      return isValid;

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Password verification failed', 
        createLogContext()
          .withError(ERROR_CODES.SYS_INTERNAL_SERVER_ERROR)
          .withMetadata({ 
            duration,
            errorMessage: error instanceof Error ? error.message : 'Unknown error' 
          })
          .build()
      );
      throw error;
    }
  }

  // Enterprise password validation with comprehensive rules
  public validatePassword(password: string): PasswordValidationResult {
    const errors: string[] = [];
    let score = 0;

    // Length validation
    if (password.length < SECURITY_CONSTANTS.PASSWORD.MIN_LENGTH) {
      errors.push(`Password must be at least ${SECURITY_CONSTANTS.PASSWORD.MIN_LENGTH} characters long`);
    } else {
      score += Math.min(password.length * 2, 20);
    }

    if (password.length > SECURITY_CONSTANTS.PASSWORD.MAX_LENGTH) {
      errors.push(`Password must not exceed ${SECURITY_CONSTANTS.PASSWORD.MAX_LENGTH} characters`);
    }

    // Character type validation
    if (SECURITY_CONSTANTS.PASSWORD.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    } else if (/[A-Z]/.test(password)) {
      score += 10;
    }

    if (SECURITY_CONSTANTS.PASSWORD.REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    } else if (/[a-z]/.test(password)) {
      score += 10;
    }

    if (SECURITY_CONSTANTS.PASSWORD.REQUIRE_NUMBERS && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    } else if (/\d/.test(password)) {
      score += 10;
    }

    if (SECURITY_CONSTANTS.PASSWORD.REQUIRE_SYMBOLS && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    } else if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      score += 15;
    }

    // Common password patterns
    if (/(.)\1{2,}/.test(password)) {
      errors.push('Password must not contain repeated characters');
      score -= 10;
    }

    if (/123|abc|qwe|password|admin/i.test(password)) {
      errors.push('Password must not contain common patterns');
      score -= 20;
    }

    // Determine strength
    let strength: 'weak' | 'medium' | 'strong';
    if (score < 30) {
      strength = 'weak';
    } else if (score < 60) {
      strength = 'medium';
    } else {
      strength = 'strong';
    }

    const result: PasswordValidationResult = {
      isValid: errors.length === 0,
      errors,
      strength,
      score: Math.max(0, Math.min(100, score)),
    };

    logger.debug('Password validation completed', 
      createLogContext()
        .withMetadata({ 
          isValid: result.isValid,
          strength: result.strength,
          score: result.score,
          errorCount: errors.length 
        })
        .build()
    );

    return result;
  }

  // Enterprise JWT token generation
  public async generateTokenPair(payload: Omit<JWTPayload, 'iat' | 'exp'>): Promise<TokenPair> {
    const startTime = Date.now();
    const logContext = createLogContext()
      .withUser(payload.userId, payload.userType)
      .withMetadata({ tokenGeneration: true })
      .build();

    try {
      const now = Math.floor(Date.now() / 1000);
      
      // Generate access token
      const accessTokenPayload: JWTPayload = {
        ...payload,
        iat: now,
        exp: now + this.parseExpirationTime(this.config.jwtExpiresIn),
      };

      const accessToken = jwt.sign(accessTokenPayload, this.config.jwtSecret, {
        algorithm: SECURITY_CONSTANTS.JWT.ALGORITHM as jwt.Algorithm,
        issuer: SECURITY_CONSTANTS.JWT.ISSUER,
        audience: SECURITY_CONSTANTS.JWT.AUDIENCE,
      });

      // Generate refresh token
      const refreshTokenPayload = {
        userId: payload.userId,
        userType: payload.userType,
        tokenType: 'refresh',
        iat: now,
        exp: now + this.parseExpirationTime(this.config.refreshTokenExpiresIn),
      };

      const refreshToken = jwt.sign(refreshTokenPayload, this.config.jwtSecret, {
        algorithm: SECURITY_CONSTANTS.JWT.ALGORITHM as jwt.Algorithm,
        issuer: SECURITY_CONSTANTS.JWT.ISSUER,
        audience: SECURITY_CONSTANTS.JWT.AUDIENCE,
      });

      // Store refresh token in cache
      await setCache(
        `${CACHE_CONSTANTS.KEYS.USER_SESSION}${payload.userId}:${refreshToken.slice(-8)}`,
        { userId: payload.userId, userType: payload.userType, createdAt: new Date() },
        { ttl: this.parseExpirationTime(this.config.refreshTokenExpiresIn) }
      );

      const duration = Date.now() - startTime;
      logger.info('Token pair generated successfully', {
        ...logContext,
        duration,
        accessTokenExp: accessTokenPayload.exp,
        refreshTokenExp: refreshTokenPayload.exp,
      });

      return {
        accessToken,
        refreshToken,
        expiresIn: this.parseExpirationTime(this.config.jwtExpiresIn),
        tokenType: 'Bearer',
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Token generation failed', {
        ...logContext,
        duration,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorCode: ERROR_CODES.AUTH_TOKEN_INVALID,
      });
      throw error;
    }
  }

  // Enterprise JWT token verification
  public async verifyToken(token: string): Promise<JWTPayload> {
    const startTime = Date.now();
    
    try {
      const decoded = jwt.verify(token, this.config.jwtSecret, {
        algorithms: [SECURITY_CONSTANTS.JWT.ALGORITHM as jwt.Algorithm],
        issuer: SECURITY_CONSTANTS.JWT.ISSUER,
        audience: SECURITY_CONSTANTS.JWT.AUDIENCE,
      }) as JWTPayload;

      const duration = Date.now() - startTime;
      logger.debug('Token verified successfully', 
        createLogContext()
          .withUser(decoded.userId, decoded.userType)
          .withMetadata({ 
            duration,
            tokenExp: decoded.exp,
            tokenIat: decoded.iat 
          })
          .build()
      );

      return decoded;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      if (error instanceof jwt.TokenExpiredError) {
        logger.warn('Token expired', 
          createLogContext()
            .withError(ERROR_CODES.AUTH_TOKEN_EXPIRED)
            .withMetadata({ duration })
            .build()
        );
        throw new Error('Token expired');
      }

      if (error instanceof jwt.JsonWebTokenError) {
        logger.warn('Invalid token', 
          createLogContext()
            .withError(ERROR_CODES.AUTH_TOKEN_INVALID)
            .withMetadata({ duration, errorMessage: error.message })
            .build()
        );
        throw new Error('Invalid token');
      }

      logger.error('Token verification failed', 
        createLogContext()
          .withError(ERROR_CODES.AUTH_TOKEN_INVALID)
          .withMetadata({ 
            duration,
            errorMessage: error instanceof Error ? error.message : 'Unknown error' 
          })
          .build()
      );
      throw error;
    }
  }

  // Enterprise refresh token validation
  public async refreshAccessToken(refreshToken: string): Promise<TokenPair> {
    const startTime = Date.now();
    
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, this.config.jwtSecret) as any;
      
      if (decoded.tokenType !== 'refresh') {
        throw new Error('Invalid refresh token type');
      }

      // Check if refresh token exists in cache
      const sessionKey = `${CACHE_CONSTANTS.KEYS.USER_SESSION}${decoded.userId}:${refreshToken.slice(-8)}`;
      const sessionData = await getCache(sessionKey);
      
      if (!sessionData) {
        throw new Error('Refresh token not found or expired');
      }

      // Generate new token pair
      const newTokenPair = await this.generateTokenPair({
        userId: decoded.userId,
        email: decoded.email || '',
        userType: decoded.userType,
        status: decoded.status || UserStatus.ACTIVE,
        permissions: decoded.permissions || [],
      });

      // Invalidate old refresh token
      await deleteCache(sessionKey);

      const duration = Date.now() - startTime;
      logger.info('Access token refreshed successfully', 
        createLogContext()
          .withUser(decoded.userId, decoded.userType)
          .withMetadata({ duration })
          .build()
      );

      return newTokenPair;

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Token refresh failed', 
        createLogContext()
          .withError(ERROR_CODES.AUTH_TOKEN_INVALID)
          .withMetadata({ 
            duration,
            errorMessage: error instanceof Error ? error.message : 'Unknown error' 
          })
          .build()
      );
      throw error;
    }
  }

  // Enterprise login attempt tracking
  public async trackLoginAttempt(identifier: string, success: boolean, ipAddress?: string): Promise<boolean> {
    const cacheKey = `${CACHE_CONSTANTS.KEYS.FAILED_LOGIN_ATTEMPTS}${identifier}`;
    
    try {
      if (success) {
        // Clear failed attempts on successful login
        await deleteCache(cacheKey);
        
        logger.audit('LOGIN_SUCCESS', 'USER', 
          createLogContext()
            .withMetadata({ identifier, ipAddress })
            .build()
        );
        
        return true;
      }

      // Track failed attempt
      const attempts = await getCache<number>(cacheKey) || 0;
      const newAttempts = attempts + 1;
      
      await setCache(cacheKey, newAttempts, { ttl: this.config.lockoutDuration / 1000 });

      logger.security('LOGIN_FAILED', 
        createLogContext()
          .withMetadata({ 
            identifier, 
            ipAddress, 
            attempts: newAttempts,
            maxAttempts: this.config.maxLoginAttempts 
          })
          .build()
      );

      // Check if account should be locked
      if (newAttempts >= this.config.maxLoginAttempts) {
        logger.security('ACCOUNT_LOCKED', 
          createLogContext()
            .withMetadata({ 
              identifier, 
              ipAddress, 
              attempts: newAttempts,
              lockoutDuration: this.config.lockoutDuration 
            })
            .build()
        );
        return false;
      }

      return true;

    } catch (error) {
      logger.error('Failed to track login attempt', 
        createLogContext()
          .withError(ERROR_CODES.SYS_REDIS_ERROR)
          .withMetadata({ 
            identifier,
            errorMessage: error instanceof Error ? error.message : 'Unknown error' 
          })
          .build()
      );
      return true; // Fail open for availability
    }
  }

  // Enterprise account lockout check
  public async isAccountLocked(identifier: string): Promise<boolean> {
    const cacheKey = `${CACHE_CONSTANTS.KEYS.FAILED_LOGIN_ATTEMPTS}${identifier}`;
    
    try {
      const attempts = await getCache<number>(cacheKey);
      return attempts !== null && attempts >= this.config.maxLoginAttempts;
    } catch (error) {
      logger.error('Failed to check account lockout status', 
        createLogContext()
          .withError(ERROR_CODES.SYS_REDIS_ERROR)
          .withMetadata({ 
            identifier,
            errorMessage: error instanceof Error ? error.message : 'Unknown error' 
          })
          .build()
      );
      return false; // Fail open for availability
    }
  }

  // Enterprise session management
  public async createSession(userId: string, userType: UserType, ipAddress?: string): Promise<string> {
    const sessionId = this.generateSessionId();
    const sessionData = {
      userId,
      userType,
      ipAddress,
      createdAt: new Date(),
      lastActivity: new Date(),
    };

    await setCache(
      `${CACHE_CONSTANTS.KEYS.USER_SESSION}${sessionId}`,
      sessionData,
      { ttl: this.config.sessionTimeout / 1000 }
    );

    logger.audit('SESSION_CREATED', 'USER', 
      createLogContext()
        .withUser(userId, userType)
        .withMetadata({ sessionId, ipAddress })
        .build()
    );

    return sessionId;
  }

  // Enterprise session validation
  public async validateSession(sessionId: string): Promise<any> {
    const sessionData = await getCache(`${CACHE_CONSTANTS.KEYS.USER_SESSION}${sessionId}`);
    
    if (!sessionData) {
      return null;
    }

    // Update last activity
    sessionData.lastActivity = new Date();
    await setCache(
      `${CACHE_CONSTANTS.KEYS.USER_SESSION}${sessionId}`,
      sessionData,
      { ttl: this.config.sessionTimeout / 1000 }
    );

    return sessionData;
  }

  // Enterprise session cleanup
  public async destroySession(sessionId: string): Promise<void> {
    await deleteCache(`${CACHE_CONSTANTS.KEYS.USER_SESSION}${sessionId}`);
    
    logger.audit('SESSION_DESTROYED', 'USER', 
      createLogContext()
        .withMetadata({ sessionId })
        .build()
    );
  }

  // Helper methods
  private parseExpirationTime(timeString: string): number {
    const match = timeString.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error(`Invalid time format: ${timeString}`);
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 60 * 60;
      case 'd': return value * 24 * 60 * 60;
      default: throw new Error(`Invalid time unit: ${unit}`);
    }
  }

  private generateSessionId(): string {
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
  }

  // Enterprise configuration getter
  public getConfig(): Readonly<AuthConfig> {
    return { ...this.config };
  }
}

// Export singleton instance and helper functions
export const authManager = AuthManager.getInstance();

// Enterprise authentication helpers
export const hashPassword = async (password: string): Promise<string> => {
  return await authManager.hashPassword(password);
};

export const verifyPassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  return await authManager.verifyPassword(password, hashedPassword);
};

export const validatePassword = (password: string): PasswordValidationResult => {
  return authManager.validatePassword(password);
};

export const generateTokens = async (payload: Omit<JWTPayload, 'iat' | 'exp'>): Promise<TokenPair> => {
  return await authManager.generateTokenPair(payload);
};

export const verifyToken = async (token: string): Promise<JWTPayload> => {
  return await authManager.verifyToken(token);
};

export const refreshToken = async (refreshToken: string): Promise<TokenPair> => {
  return await authManager.refreshAccessToken(refreshToken);
};

export const trackLogin = async (identifier: string, success: boolean, ipAddress?: string): Promise<boolean> => {
  return await authManager.trackLoginAttempt(identifier, success, ipAddress);
};

export const checkAccountLock = async (identifier: string): Promise<boolean> => {
  return await authManager.isAccountLocked(identifier);
};
