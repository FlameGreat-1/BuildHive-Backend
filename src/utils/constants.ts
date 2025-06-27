export const APP_CONSTANTS = {
  NAME: 'BuildHive',
  VERSION: '1.0.0',
  API_PREFIX: '/api/v1',
  DEFAULT_TIMEZONE: 'UTC',
  SUPPORTED_LOCALES: ['en-US', 'en-AU'],
  MAX_REQUEST_SIZE: '10mb',
  REQUEST_TIMEOUT: 30000,
} as const;

export const SECURITY_CONSTANTS = {
  JWT: {
    ACCESS_TOKEN_EXPIRES: '15m',
    REFRESH_TOKEN_EXPIRES: '7d',
    ALGORITHM: 'HS256',
    ISSUER: 'BuildHive',
    AUDIENCE: 'BuildHive-Users',
  },
  PASSWORD: {
    MIN_LENGTH: 8,
    MAX_LENGTH: 128,
    BCRYPT_ROUNDS: 12,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBERS: true,
    REQUIRE_SYMBOLS: true,
  },
  RATE_LIMITING: {
    WINDOW_MS: 15 * 60 * 1000,
    MAX_REQUESTS: 100,
    AUTH_WINDOW_MS: 15 * 60 * 1000,
    AUTH_MAX_REQUESTS: 5,
    SKIP_SUCCESSFUL_REQUESTS: false,
  },
  SESSION: {
    MAX_CONCURRENT_SESSIONS: 5,
    IDLE_TIMEOUT: 30 * 60 * 1000,
    ABSOLUTE_TIMEOUT: 8 * 60 * 60 * 1000,
  },
} as const;

export const ERROR_CODES = {
  AUTH_INVALID_CREDENTIALS: 'AUTH_001',
  AUTH_USER_NOT_FOUND: 'AUTH_002',
  AUTH_USER_SUSPENDED: 'AUTH_003',
  AUTH_ACCOUNT_SUSPENDED: 'AUTH_004',
  AUTH_ACCOUNT_LOCKED: 'AUTH_005',
  AUTH_EMAIL_NOT_VERIFIED: 'AUTH_006',
  AUTH_PHONE_NOT_VERIFIED: 'AUTH_007',
  AUTH_TOKEN_EXPIRED: 'AUTH_008',
  AUTH_TOKEN_INVALID: 'AUTH_009',
  AUTH_INSUFFICIENT_PERMISSIONS: 'AUTH_010',
  AUTH_PASSWORD_EXPIRED: 'AUTH_011',
  AUTH_MFA_REQUIRED: 'AUTH_012',
  AUTH_MFA_INVALID: 'AUTH_013',

  VAL_REQUIRED_FIELD: 'VAL_001',
  VAL_INVALID_EMAIL: 'VAL_002',
  VAL_INVALID_PHONE: 'VAL_003',
  VAL_PASSWORD_TOO_WEAK: 'VAL_004',
  VAL_WEAK_PASSWORD: 'VAL_005',
  VAL_INVALID_INPUT: 'VAL_006',
  VAL_INVALID_USER_TYPE: 'VAL_007',
  VAL_INVALID_FILE_TYPE: 'VAL_008',
  VAL_FILE_TOO_LARGE: 'VAL_009',
  VAL_INVALID_ABN: 'VAL_010',
  VAL_INVALID_DATE_FORMAT: 'VAL_011',
  VAL_INVALID_ENUM_VALUE: 'VAL_012',

  BIZ_EMAIL_ALREADY_EXISTS: 'BIZ_001',
  BIZ_PHONE_ALREADY_EXISTS: 'BIZ_002',
  BIZ_ABN_ALREADY_EXISTS: 'BIZ_003',
  BIZ_VERIFICATION_CODE_EXPIRED: 'BIZ_004',
  BIZ_VERIFICATION_CODE_INVALID: 'BIZ_005',
  BIZ_DOCUMENT_ALREADY_UPLOADED: 'BIZ_006',
  BIZ_PROFILE_INCOMPLETE: 'BIZ_007',
  BIZ_VERIFICATION_PENDING: 'BIZ_008',
  BIZ_OPERATION_NOT_ALLOWED: 'BIZ_009',
  BIZ_RESOURCE_NOT_FOUND: 'BIZ_010',

  SYS_DATABASE_ERROR: 'SYS_001',
  SYS_REDIS_ERROR: 'SYS_002',
  SYS_FILE_UPLOAD_ERROR: 'SYS_003',
  SYS_EMAIL_SERVICE_ERROR: 'SYS_004',
  SYS_SMS_SERVICE_ERROR: 'SYS_005',
  SYS_EXTERNAL_API_ERROR: 'SYS_006',
  SYS_CONFIGURATION_ERROR: 'SYS_007',
  SYS_INTERNAL_SERVER_ERROR: 'SYS_008',
  SYS_SERVICE_UNAVAILABLE: 'SYS_009',
  SYS_TIMEOUT_ERROR: 'SYS_010',
  SYS_NOTIFICATION_ERROR: 'SYS_011',
} as const;

export const VALIDATION_CONSTANTS = {
  EMAIL: {
    MAX_LENGTH: 254,
    REGEX: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  },
  PHONE: {
    MIN_LENGTH: 10,
    MAX_LENGTH: 15,
    REGEX: /^\+?[1-9]\d{1,14}$/,
  },
  NAME: {
    MIN_LENGTH: 2,
    MAX_LENGTH: 50,
    REGEX: /^[a-zA-Z\s'-]+$/,
  },
  ABN: {
    LENGTH: 11,
    REGEX: /^\d{11}$/,
  },
  COMPANY_NAME: {
    MIN_LENGTH: 2,
    MAX_LENGTH: 100,
    REGEX: /^[a-zA-Z0-9\s&.,'-]+$/,
  },
  FILE: {
    MAX_SIZE: 10 * 1024 * 1024,
    ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
    ALLOWED_DOCUMENT_TYPES: ['application/pdf', 'image/jpeg', 'image/png'],
    MAX_FILES_PER_UPLOAD: 5,
  },
} as const;

export const DATABASE_CONSTANTS = {
  CONNECTION: {
    MAX_CONNECTIONS: 20,
    IDLE_TIMEOUT: 30000,
    CONNECTION_TIMEOUT: 60000,
    STATEMENT_TIMEOUT: 30000,
  },
  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
  },
  SOFT_DELETE: {
    FIELD: 'isDeleted',
    DELETED_AT_FIELD: 'deletedAt',
    DELETED_BY_FIELD: 'deletedBy',
  },
} as const;

export const CACHE_CONSTANTS = {
  TTL: {
    SHORT: 5 * 60,
    MEDIUM: 30 * 60,
    LONG: 24 * 60 * 60,
    VERY_LONG: 7 * 24 * 60 * 60,
  },
  KEYS: {
    USER_SESSION: 'session:user:',
    USER_SESSIONS: 'sessions:user:',
    VERIFICATION_CODE: 'verification:',
    RATE_LIMIT: 'rate_limit:',
    USER_PROFILE: 'profile:user:',
    FAILED_LOGIN_ATTEMPTS: 'failed_login:',
    PASSWORD_RESET: 'password_reset:',
  },
  PREFIXES: {
    AUTH: 'auth:',
    USER: 'user:',
    JOB: 'job:',
    PAYMENT: 'payment:',
    NOTIFICATION: 'notification:',
  },
} as const;

export const EVENT_CONSTANTS = {
  TYPES: {
    USER_REGISTERED: 'user.registered',
    USER_EMAIL_VERIFIED: 'user.email_verified',
    USER_PHONE_VERIFIED: 'user.phone_verified',
    USER_PROFILE_COMPLETED: 'user.profile_completed',
    USER_VERIFIED: 'user.verified',
    USER_SUSPENDED: 'user.suspended',
    USER_LOGGED_IN: 'user.logged_in',
    USER_LOGGED_OUT: 'user.logged_out',
    
    DOCUMENT_UPLOADED: 'document.uploaded',
    DOCUMENT_VERIFIED: 'document.verified',
    DOCUMENT_REJECTED: 'document.rejected',
    
    SYSTEM_ERROR: 'system.error',
    SECURITY_BREACH: 'security.breach',
    RATE_LIMIT_EXCEEDED: 'rate_limit.exceeded',
  },
  CHANNELS: {
    USER_NOTIFICATIONS: 'user_notifications',
    ADMIN_ALERTS: 'admin_alerts',
    SYSTEM_EVENTS: 'system_events',
    AUDIT_LOGS: 'audit_logs',
  },
} as const;

export const NOTIFICATION_CONSTANTS = {
  TYPES: {
    EMAIL: 'email',
    SMS: 'sms',
    PUSH: 'push',
    IN_APP: 'in_app',
  },
  TEMPLATES: {
    WELCOME_EMAIL: 'welcome_email',
    EMAIL_VERIFICATION: 'email_verification',
    PHONE_VERIFICATION: 'phone_verification',
    PASSWORD_RESET: 'password_reset',
    DOCUMENT_APPROVED: 'document_approved',
    DOCUMENT_REJECTED: 'document_rejected',
    ACCOUNT_SUSPENDED: 'account_suspended',
  },
  PRIORITIES: {
    LOW: 1,
    MEDIUM: 2,
    HIGH: 3,
    CRITICAL: 4,
  },
} as const;

export const AUDIT_CONSTANTS = {
  ACTIONS: {
    CREATE: 'CREATE',
    READ: 'READ',
    UPDATE: 'UPDATE',
    DELETE: 'DELETE',
    LOGIN: 'LOGIN',
    LOGOUT: 'LOGOUT',
    UPLOAD: 'UPLOAD',
    DOWNLOAD: 'DOWNLOAD',
    APPROVE: 'APPROVE',
    REJECT: 'REJECT',
    SUSPEND: 'SUSPEND',
    ACTIVATE: 'ACTIVATE',
  },
  RESOURCES: {
    USER: 'USER',
    PROFILE: 'PROFILE',
    DOCUMENT: 'DOCUMENT',
    JOB: 'JOB',
    APPLICATION: 'APPLICATION',
    PAYMENT: 'PAYMENT',
    ENTERPRISE: 'ENTERPRISE',
  },
} as const;

export const FILE_CONSTANTS = {
  PATHS: {
    DOCUMENTS: 'documents/',
    PROFILES: 'profiles/',
    PORTFOLIOS: 'portfolios/',
    TEMP: 'temp/',
  },
  VIRUS_SCAN: {
    ENABLED: true,
    QUARANTINE_PATH: 'quarantine/',
    MAX_SCAN_TIME: 30000,
  },
} as const;

export const MONITORING_CONSTANTS = {
  HEALTH_CHECK: {
    INTERVAL: 30000,
    TIMEOUT: 5000,
    RETRIES: 3,
  },
  METRICS: {
    COLLECTION_INTERVAL: 60000,
    RETENTION_DAYS: 30,
  },
  ALERTS: {
    ERROR_THRESHOLD: 10,
    RESPONSE_TIME_THRESHOLD: 2000,
    CPU_THRESHOLD: 80,
    MEMORY_THRESHOLD: 85,
  },
} as const;

export const ENVIRONMENT_CONSTANTS = {
  DEVELOPMENT: {
    LOG_LEVEL: 'debug',
    ENABLE_CORS: true,
    ENABLE_SWAGGER: true,
    MOCK_EXTERNAL_SERVICES: true,
  },
  STAGING: {
    LOG_LEVEL: 'info',
    ENABLE_CORS: true,
    ENABLE_SWAGGER: true,
    MOCK_EXTERNAL_SERVICES: false,
  },
  PRODUCTION: {
    LOG_LEVEL: 'warn',
    ENABLE_CORS: false,
    ENABLE_SWAGGER: false,
    MOCK_EXTERNAL_SERVICES: false,
  },
} as const;
