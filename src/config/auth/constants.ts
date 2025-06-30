export const USER_ROLES = {
  CLIENT: 'client',
  TRADIE: 'tradie', 
  ENTERPRISE: 'enterprise',
  ADMIN: 'admin',
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

export const USER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
  PENDING: 'pending',
} as const;

export type UserStatus = typeof USER_STATUS[keyof typeof USER_STATUS];

export const VERIFICATION_STATUS = {
  PENDING: 'pending',
  VERIFIED: 'verified',
  REJECTED: 'rejected',
} as const;

export type VerificationStatus = typeof VERIFICATION_STATUS[keyof typeof VERIFICATION_STATUS];

export const TOKEN_TYPES = {
  ACCESS: 'access',
  REFRESH: 'refresh',
  EMAIL_VERIFICATION: 'email_verification',
  PASSWORD_RESET: 'password_reset',
} as const;

export type TokenType = typeof TOKEN_TYPES[keyof typeof TOKEN_TYPES];

export const SESSION_CONFIG = {
  MAX_ACTIVE_SESSIONS: 5,
  SESSION_TIMEOUT_HOURS: 24,
  REMEMBER_ME_DAYS: 30,
} as const;

export const PASSWORD_CONFIG = {
  MIN_LENGTH: 8,
  MAX_LENGTH: 128,
  REQUIRE_UPPERCASE: true,
  REQUIRE_LOWERCASE: true,
  REQUIRE_NUMBERS: true,
  REQUIRE_SPECIAL_CHARS: true,
  SPECIAL_CHARS: '!@#$%^&*()_+-=[]{}|;:,.<>?',
} as const;

export const UPLOAD_CONFIG = {
  PROFILE_IMAGE: {
    MAX_SIZE: 5 * 1024 * 1024,
    ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
    MAX_WIDTH: 1024,
    MAX_HEIGHT: 1024,
  },
  DOCUMENT: {
    MAX_SIZE: 10 * 1024 * 1024,
    ALLOWED_TYPES: ['application/pdf', 'image/jpeg', 'image/png'],
  },
} as const;

export const BUSINESS_CONFIG = {
  ABN_LENGTH: 11,
  ACN_LENGTH: 9,
  PHONE_REGEX: /^(\+61|0)[2-9]\d{8}$/,
  POSTCODE_REGEX: /^\d{4}$/,
} as const;

export const SERVICE_CATEGORIES = {
  ELECTRICAL: 'electrical',
  PLUMBING: 'plumbing',
  CARPENTRY: 'carpentry',
  PAINTING: 'painting',
  ROOFING: 'roofing',
  LANDSCAPING: 'landscaping',
  TILING: 'tiling',
  FLOORING: 'flooring',
  HANDYMAN: 'handyman',
  CLEANING: 'cleaning',
  OTHER: 'other',
} as const;

export type ServiceCategory = typeof SERVICE_CATEGORIES[keyof typeof SERVICE_CATEGORIES];

export const RATE_LIMITS = {
  AUTH: {
    LOGIN: { windowMs: 15 * 60 * 1000, max: 5 },
    REGISTER: { windowMs: 60 * 60 * 1000, max: 3 },
    PASSWORD_RESET: { windowMs: 60 * 60 * 1000, max: 3 },
    EMAIL_VERIFICATION: { windowMs: 60 * 60 * 1000, max: 5 },
  },
  PROFILE: {
    UPDATE: { windowMs: 15 * 60 * 1000, max: 10 },
    IMAGE_UPLOAD: { windowMs: 60 * 60 * 1000, max: 5 },
  },
} as const;

export const VALIDATION_MESSAGES = {
  REQUIRED: 'This field is required',
  INVALID_EMAIL: 'Please enter a valid email address',
  INVALID_PHONE: 'Please enter a valid Australian phone number',
  INVALID_ABN: 'Please enter a valid 11-digit ABN',
  INVALID_POSTCODE: 'Please enter a valid 4-digit postcode',
  PASSWORD_TOO_SHORT: `Password must be at least ${PASSWORD_CONFIG.MIN_LENGTH} characters`,
  PASSWORD_TOO_LONG: `Password must not exceed ${PASSWORD_CONFIG.MAX_LENGTH} characters`,
  PASSWORD_REQUIREMENTS: 'Password must contain uppercase, lowercase, number and special character',
  PASSWORDS_DONT_MATCH: 'Passwords do not match',
  FILE_TOO_LARGE: 'File size exceeds maximum limit',
  INVALID_FILE_TYPE: 'File type not supported',
} as const;

export const RESPONSE_MESSAGES = {
  SUCCESS: {
    USER_REGISTERED: 'User registered successfully',
    USER_LOGGED_IN: 'User logged in successfully',
    USER_LOGGED_OUT: 'User logged out successfully',
    PROFILE_UPDATED: 'Profile updated successfully',
    EMAIL_VERIFIED: 'Email verified successfully',
    PASSWORD_RESET_SENT: 'Password reset link sent to your email',
    PASSWORD_RESET_SUCCESS: 'Password reset successfully',
  },
  ERROR: {
    USER_NOT_FOUND: 'User not found',
    INVALID_CREDENTIALS: 'Invalid email or password',
    EMAIL_ALREADY_EXISTS: 'Email address already registered',
    PHONE_ALREADY_EXISTS: 'Phone number already registered',
    ABN_ALREADY_EXISTS: 'ABN already registered',
    INVALID_TOKEN: 'Invalid or expired token',
    UNAUTHORIZED: 'Unauthorized access',
    FORBIDDEN: 'Access forbidden',
    ACCOUNT_SUSPENDED: 'Account has been suspended',
    EMAIL_NOT_VERIFIED: 'Please verify your email address',
    RATE_LIMIT_EXCEEDED: 'Too many requests. Please try again later',
    INTERNAL_SERVER_ERROR: 'Internal server error',
  },
} as const;

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
} as const;

export const COLLECTIONS = {
  USERS: 'users',
  PROFILES: 'profiles',
  SESSIONS: 'sessions',
  TOKENS: 'tokens',
} as const;

export const CACHE_KEYS = {
  USER_SESSION: (userId: string) => `session:${userId}`,
  USER_PROFILE: (userId: string) => `profile:${userId}`,
  EMAIL_VERIFICATION: (email: string) => `email_verify:${email}`,
  PASSWORD_RESET: (email: string) => `password_reset:${email}`,
  RATE_LIMIT: (ip: string, action: string) => `rate_limit:${ip}:${action}`,
} as const;

export const EVENTS = {
  USER_REGISTERED: 'user.registered',
  USER_VERIFIED: 'user.verified',
  PROFILE_UPDATED: 'profile.updated',
  USER_LOGIN: 'user.login',
  USER_LOGOUT: 'user.logout',
} as const;

export default {
  USER_ROLES,
  USER_STATUS,
  VERIFICATION_STATUS,
  TOKEN_TYPES,
  SESSION_CONFIG,
  PASSWORD_CONFIG,
  UPLOAD_CONFIG,
  BUSINESS_CONFIG,
  SERVICE_CATEGORIES,
  RATE_LIMITS,
  VALIDATION_MESSAGES,
  RESPONSE_MESSAGES,
  HTTP_STATUS,
  COLLECTIONS,
  CACHE_KEYS,
  EVENTS,
};
