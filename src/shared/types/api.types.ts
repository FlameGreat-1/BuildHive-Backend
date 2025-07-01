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

export interface ErrorResponse {
  success: false;
  message: string;
  errors?: ValidationError[];
  timestamp: string;
  requestId: string;
  statusCode: number;
}
