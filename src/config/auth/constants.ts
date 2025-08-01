import { UserRole, UserStatus, AuthProvider } from '../../shared/types';

export const AUTH_CONSTANTS = {
  USER_ROLES: {
    CLIENT: UserRole.CLIENT,
    TRADIE: UserRole.TRADIE,
    ENTERPRISE: UserRole.ENTERPRISE
  },
  
  USER_STATUS: {
    PENDING: UserStatus.PENDING,
    ACTIVE: UserStatus.ACTIVE,
    SUSPENDED: UserStatus.SUSPENDED
  },
  
  AUTH_PROVIDERS: {
    LOCAL: AuthProvider.LOCAL,
    GOOGLE: AuthProvider.GOOGLE,
    LINKEDIN: AuthProvider.LINKEDIN,
    FACEBOOK: AuthProvider.FACEBOOK
  },
  
  PASSWORD_REQUIREMENTS: {
    MIN_LENGTH: 8,
    MAX_LENGTH: 128,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBERS: true,
    REQUIRE_SPECIAL_CHARS: true
  },
  
  USERNAME_REQUIREMENTS: {
    MIN_LENGTH: 3,
    MAX_LENGTH: 30,
    ALLOWED_PATTERN: /^[a-zA-Z0-9_-]+$/
  },
  
  EMAIL_REQUIREMENTS: {
    MAX_LENGTH: 254,
    PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  
  RATE_LIMITS: {
    REGISTRATION: {
      WINDOW_MS: 15 * 60 * 1000,
      MAX_ATTEMPTS: 5
    },
    EMAIL_VERIFICATION: {
      WINDOW_MS: 60 * 60 * 1000,
      MAX_ATTEMPTS: 3
    },
    LOGIN: {
      WINDOW_MS: 15 * 60 * 1000,
      MAX_ATTEMPTS: 5
    },
    PASSWORD_RESET: {
      WINDOW_MS: 60 * 60 * 1000,
      MAX_ATTEMPTS: 3
    },
    CHANGE_PASSWORD: {
      WINDOW_MS: 60 * 60 * 1000,
      MAX_ATTEMPTS: 3
    }
  },
  
  TOKEN_TYPES: {
    ACCESS: 'access',
    REFRESH: 'refresh',
    EMAIL_VERIFICATION: 'email_verification',
    PASSWORD_RESET: 'password_reset'
  },
  
  SESSION_TYPES: {
    ACCESS: 'access',
    REFRESH: 'refresh',
    PASSWORD_RESET: 'password_reset'
  },
  
  VERIFICATION_CODE: {
    LENGTH: 6,
    EXPIRES_IN_MINUTES: 15,
    MAX_ATTEMPTS: 3
  },
  
  PASSWORD_RESET: {
    TOKEN_EXPIRES_MINUTES: 30,
    MAX_ATTEMPTS: 3,
    COOLDOWN_MINUTES: 5
  },
  
  REFRESH_TOKEN: {
    EXPIRES_IN: '7d',
    ROTATION_ENABLED: true
  },
  
  LOGIN_ATTEMPTS: {
    MAX_ATTEMPTS: 5,
    LOCKOUT_DURATION_MINUTES: 15,
    RESET_TIME_MINUTES: 60
  }
} as const;

export const HTTP_STATUS_CODES = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  PAYMENT_REQUIRED: 402,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  NOT_ACCEPTABLE: 406,
  REQUEST_TIMEOUT: 408,
  CONFLICT: 409,
  GONE: 410,
  PRECONDITION_FAILED: 412,
  PAYLOAD_TOO_LARGE: 413,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
  HTTP_VERSION_NOT_SUPPORTED: 505
} as const;

export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  USER_EXISTS: 'USER_EXISTS',
  EMAIL_EXISTS: 'EMAIL_EXISTS',
  USERNAME_EXISTS: 'USERNAME_EXISTS',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  PASSWORD_RESET_REQUIRED: 'PASSWORD_RESET_REQUIRED',
  INVALID_PASSWORD_RESET_TOKEN: 'INVALID_PASSWORD_RESET_TOKEN',
  PASSWORD_RESET_EXPIRED: 'PASSWORD_RESET_EXPIRED',
  SAME_PASSWORD: 'SAME_PASSWORD',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  PAYMENT_ERROR: 'PAYMENT_ERROR',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  PAYMENT_CANCELLED: 'PAYMENT_CANCELLED',
  PAYMENT_REQUIRES_ACTION: 'PAYMENT_REQUIRES_ACTION',
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  INVALID_PAYMENT_METHOD: 'INVALID_PAYMENT_METHOD',
  PAYMENT_METHOD_NOT_FOUND: 'PAYMENT_METHOD_NOT_FOUND',
  STRIPE_ERROR: 'STRIPE_ERROR',
  WEBHOOK_ERROR: 'WEBHOOK_ERROR',
  WEBHOOK_SIGNATURE_INVALID: 'WEBHOOK_SIGNATURE_INVALID',
  WEBHOOK_EVENT_INVALID: 'WEBHOOK_EVENT_INVALID',
  WEBHOOK_PROCESSING_FAILED: 'WEBHOOK_PROCESSING_FAILED',
  INVOICE_ERROR: 'INVOICE_ERROR',
  INVOICE_NOT_FOUND: 'INVOICE_NOT_FOUND',
  INVOICE_ALREADY_PAID: 'INVOICE_ALREADY_PAID',
  REFUND_ERROR: 'REFUND_ERROR',
  REFUND_NOT_FOUND: 'REFUND_NOT_FOUND',
  REFUND_ALREADY_PROCESSED: 'REFUND_ALREADY_PROCESSED',
  SUBSCRIPTION_ERROR: 'SUBSCRIPTION_ERROR',
  SUBSCRIPTION_NOT_FOUND: 'SUBSCRIPTION_NOT_FOUND',
  SUBSCRIPTION_CANCELLED: 'SUBSCRIPTION_CANCELLED',
  CREDIT_ERROR: 'CREDIT_ERROR',
  INSUFFICIENT_CREDITS: 'INSUFFICIENT_CREDITS',
  JOB_ERROR: 'JOB_ERROR',
  JOB_NOT_FOUND: 'JOB_NOT_FOUND',
  UNAUTHORIZED_JOB_ACCESS: 'UNAUTHORIZED_JOB_ACCESS',
  QUOTE_ERROR: 'QUOTE_ERROR',
  QUOTE_NOT_FOUND: 'QUOTE_NOT_FOUND',
  QUOTE_EXPIRED: 'QUOTE_EXPIRED',
  QUOTE_ALREADY_ACCEPTED: 'QUOTE_ALREADY_ACCEPTED',
  CLIENT_ERROR: 'CLIENT_ERROR',
  CLIENT_NOT_FOUND: 'CLIENT_NOT_FOUND',
  FILE_UPLOAD_ERROR: 'FILE_UPLOAD_ERROR',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  DATABASE_ERROR: 'DATABASE_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  SERVICE_UNAVAILABLE_ERROR: 'SERVICE_UNAVAILABLE_ERROR'
} as const;

export const API_CONSTANTS = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  DEFAULT_SORT_ORDER: 'desc',
  MAX_SEARCH_LENGTH: 100,
  REQUEST_TIMEOUT: 30000,
  MAX_FILE_SIZE: 10 * 1024 * 1024,
  ALLOWED_FILE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain'],
  MAX_BULK_OPERATIONS: 50
} as const;

export const CACHE_CONSTANTS = {
  TTL: {
    SHORT: 300,
    MEDIUM: 1800,
    LONG: 3600,
    VERY_LONG: 86400
  },
  KEYS: {
    USER_PROFILE: 'user:profile:',
    USER_PERMISSIONS: 'user:permissions:',
    JOB_DETAILS: 'job:details:',
    QUOTE_DETAILS: 'quote:details:',
    CLIENT_DETAILS: 'client:details:',
    PAYMENT_STATUS: 'payment:status:',
    RATE_LIMIT: 'rate_limit:'
  }
} as const;

export const SECURITY_CONSTANTS = {
  BCRYPT_ROUNDS: 12,
  JWT_ALGORITHM: 'HS256',
  CSRF_TOKEN_LENGTH: 32,
  SESSION_SECRET_LENGTH: 64,
  API_KEY_LENGTH: 32,
  WEBHOOK_SECRET_LENGTH: 32,
  ENCRYPTION_ALGORITHM: 'aes-256-gcm',
  HASH_ALGORITHM: 'sha256'
} as const;
