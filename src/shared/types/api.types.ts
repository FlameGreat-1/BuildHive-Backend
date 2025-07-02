export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: ValidationError[];
  timestamp: string;
  requestId: string;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResponse<T = any> extends ApiResponse<T> {
  meta: PaginationMeta;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  role: string;
  authProvider?: string;
  socialId?: string;
  socialData?: SocialAuthData;
}

export interface SocialAuthData {
  id: string;
  email: string;
  name: string;
  picture?: string;
  provider: string;
}

export interface RegisterResponse {
  user: {
    id: string;
    username: string;
    email: string;
    role: string;
    status: string;
    createdAt: string;
  };
  requiresVerification: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface LoginResponse {
  user: {
    id: string;
    username: string;
    email: string;
    role: string;
    status: string;
    emailVerified: boolean;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
  profile?: {
    firstName?: string;
    lastName?: string;
    avatar?: string;
  };
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetResponse {
  success: boolean;
  message: string;
  resetTokenSent: boolean;
}

export interface PasswordResetConfirmRequest {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

export interface PasswordResetConfirmResponse {
  success: boolean;
  message: string;
  passwordReset: boolean;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ChangePasswordResponse {
  success: boolean;
  message: string;
  passwordChanged: boolean;
}

export interface LogoutRequest {
  refreshToken?: string;
  logoutAllDevices?: boolean;
}

export interface LogoutResponse {
  success: boolean;
  message: string;
  loggedOut: boolean;
}

export interface ErrorResponse {
  success: false;
  message: string;
  errors?: ValidationError[];
  timestamp: string;
  requestId: string;
  statusCode: number;
}

