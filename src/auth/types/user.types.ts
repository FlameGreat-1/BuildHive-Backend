import { UserRole, UserStatus, AuthProvider } from '../../shared/types';

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash?: string;
  role: UserRole;
  status: UserStatus;
  authProvider: AuthProvider;
  socialId?: string;
  emailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserData {
  username: string;
  email: string;
  password?: string;
  role: UserRole;
  authProvider: AuthProvider;
  socialId?: string;
  socialData?: SocialUserData;
}

export interface SocialUserData {
  id: string;
  email: string;
  name: string;
  picture?: string;
  provider: AuthProvider;
  accessToken?: string;
}

export interface UserRegistrationData {
  username: string;
  email: string;
  password?: string;
  role: UserRole;
  authProvider: AuthProvider;
  socialId?: string;
  socialData?: SocialUserData;
}

export interface UserPublicData {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  createdAt: Date;
}

export interface UserExistsCheck {
  email: boolean;
  username: boolean;
  socialId: boolean;
}
