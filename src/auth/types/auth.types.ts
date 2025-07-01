import { UserRole, AuthProvider } from '../../shared/types';
import { SocialUserData } from './user.types';

export interface RegisterLocalRequest {
  username: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface RegisterSocialRequest {
  authProvider: AuthProvider;
  socialId: string;
  socialData: SocialUserData;
  role: UserRole;
}

export interface RegisterResponse {
  success: boolean;
  message: string;
  user: {
    id: string;
    username: string;
    email: string;
    role: UserRole;
    status: string;
    emailVerified: boolean;
    createdAt: string;
  };
  requiresVerification: boolean;
  verificationSent: boolean;
}

export interface EmailVerificationRequest {
  token: string;
  email: string;
}

export interface EmailVerificationResponse {
  success: boolean;
  message: string;
  verified: boolean;
}

export interface ResendVerificationRequest {
  email: string;
}

export interface ResendVerificationResponse {
  success: boolean;
  message: string;
  sent: boolean;
}

export interface AuthTokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}

export interface SocialAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
  scope?: string[];
}

export interface GoogleAuthData extends SocialUserData {
  provider: AuthProvider.GOOGLE;
  given_name?: string;
  family_name?: string;
  locale?: string;
}

export interface LinkedInAuthData extends SocialUserData {
  provider: AuthProvider.LINKEDIN;
  firstName?: string;
  lastName?: string;
  profilePicture?: string;
}

export interface FacebookAuthData extends SocialUserData {
  provider: AuthProvider.FACEBOOK;
  first_name?: string;
  last_name?: string;
}
