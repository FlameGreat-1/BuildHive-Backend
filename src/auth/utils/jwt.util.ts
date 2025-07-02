import jwt, { SignOptions } from 'jsonwebtoken';
import { environment } from '../../config/auth';
import { AuthTokenPayload, RefreshTokenPayload, PasswordResetTokenPayload } from '../types';
import { UserRole } from '../../shared/types';
import { AUTH_CONSTANTS } from '../../config/auth';

export const generateAccessToken = (
  userId: string,
  email: string,
  role: UserRole
): string => {
  const payload: Omit<AuthTokenPayload, 'iat' | 'exp'> = {
    userId,
    email,
    role
  };

  return jwt.sign(payload, environment.JWT_SECRET, {
    expiresIn: environment.JWT_EXPIRES_IN as string | number,
    issuer: 'buildhive-auth',
    audience: 'buildhive-app'
  } as SignOptions);
};

export const generateRefreshToken = (
  userId: string,
  email: string,
  role: UserRole,
  tokenId: string
): string => {
  const payload: Omit<RefreshTokenPayload, 'iat' | 'exp'> = {
    userId,
    email,
    role,
    tokenId
  };

  return jwt.sign(payload, environment.JWT_SECRET, {
    expiresIn: AUTH_CONSTANTS.REFRESH_TOKEN.EXPIRES_IN,
    issuer: 'buildhive-auth',
    audience: 'buildhive-refresh'
  } as SignOptions);
};

export const generatePasswordResetToken = (
  userId: string,
  email: string
): string => {
  const payload: Omit<PasswordResetTokenPayload, 'iat' | 'exp'> = {
    userId,
    email,
    type: 'password_reset'
  };

  return jwt.sign(payload, environment.JWT_SECRET, {
    expiresIn: `${AUTH_CONSTANTS.PASSWORD_RESET.TOKEN_EXPIRES_MINUTES}m`,
    issuer: 'buildhive-auth',
    audience: 'buildhive-password-reset'
  } as SignOptions);
};

export const generateEmailVerificationToken = (
  userId: string,
  email: string
): string => {
  const payload = {
    userId,
    email,
    type: 'email_verification'
  };

  return jwt.sign(payload, environment.JWT_SECRET, {
    expiresIn: '24h',
    issuer: 'buildhive-auth',
    audience: 'buildhive-verification'
  } as SignOptions);
};

export const verifyToken = (token: string): AuthTokenPayload => {
  try {
    const decoded = jwt.verify(token, environment.JWT_SECRET, {
      issuer: 'buildhive-auth',
      audience: 'buildhive-app'
    }) as AuthTokenPayload;

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token has expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    }
    throw new Error('Token verification failed');
  }
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  try {
    const decoded = jwt.verify(token, environment.JWT_SECRET, {
      issuer: 'buildhive-auth',
      audience: 'buildhive-refresh'
    }) as RefreshTokenPayload;

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Refresh token has expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid refresh token');
    }
    throw new Error('Refresh token verification failed');
  }
};

export const verifyPasswordResetToken = (token: string): PasswordResetTokenPayload => {
  try {
    const decoded = jwt.verify(token, environment.JWT_SECRET, {
      issuer: 'buildhive-auth',
      audience: 'buildhive-password-reset'
    }) as PasswordResetTokenPayload;

    if (decoded.type !== 'password_reset') {
      throw new Error('Invalid token type');
    }

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Password reset token has expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid password reset token');
    }
    throw new Error('Password reset token verification failed');
  }
};

export const verifyEmailVerificationToken = (token: string): { userId: string; email: string } => {
  try {
    const decoded = jwt.verify(token, environment.JWT_SECRET, {
      issuer: 'buildhive-auth',
      audience: 'buildhive-verification'
    }) as any;

    if (decoded.type !== 'email_verification') {
      throw new Error('Invalid token type');
    }

    return {
      userId: decoded.userId,
      email: decoded.email
    };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Verification token has expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid verification token');
    }
    throw new Error('Token verification failed');
  }
};

export const extractTokenFromHeader = (authHeader: string): string | null => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  return authHeader.substring(7);
};

export const isTokenExpired = (token: string): boolean => {
  try {
    const decoded = jwt.decode(token) as any;
    if (!decoded || !decoded.exp) {
      return true;
    }
    
    const currentTime = Math.floor(Date.now() / 1000);
    return decoded.exp < currentTime;
  } catch {
    return true;
  }
};

export const getTokenExpirationTime = (token: string): number | null => {
  try {
    const decoded = jwt.decode(token) as any;
    return decoded?.exp || null;
  } catch {
    return null;
  }
};

export const generateTokenId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};
