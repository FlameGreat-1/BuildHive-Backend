import jwt, { SignOptions } from 'jsonwebtoken';
import { environment } from '../../config/auth';
import { AuthTokenPayload } from '../types';
import { UserRole } from '../../shared/types';

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

  const options: SignOptions = {
    expiresIn: environment.JWT_EXPIRES_IN,
    issuer: 'buildhive-auth',
    audience: 'buildhive-app'
  };

  return jwt.sign(payload, environment.JWT_SECRET as string, options);
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

  const options: SignOptions = {
    expiresIn: '24h',
    issuer: 'buildhive-auth',
    audience: 'buildhive-verification'
  };

  return jwt.sign(payload, environment.JWT_SECRET as string, options);
};

export const verifyToken = (token: string): AuthTokenPayload => {
  try {
    const decoded = jwt.verify(token, environment.JWT_SECRET as string, {
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

export const verifyEmailVerificationToken = (token: string): { userId: string; email: string } => {
  try {
    const decoded = jwt.verify(token, environment.JWT_SECRET as string, {
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
