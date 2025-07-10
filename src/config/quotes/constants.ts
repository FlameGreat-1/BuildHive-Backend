export const QUOTE_STATUS = {
  DRAFT: 'draft',
  SENT: 'sent',
  VIEWED: 'viewed',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled'
} as const;

export const QUOTE_ITEM_TYPE = {
  LABOUR: 'labour',
  MATERIAL: 'material',
  EQUIPMENT: 'equipment',
  SUBCONTRACTOR: 'subcontractor',
  PERMIT: 'permit',
  TRAVEL: 'travel',
  MARKUP: 'markup',
  DISCOUNT: 'discount'
} as const;

export const DELIVERY_METHOD = {
  EMAIL: 'email',
  SMS: 'sms',
  PDF: 'pdf',
  PORTAL: 'portal'
} as const;

export const QUOTE_CONSTANTS = {
  MAX_TITLE_LENGTH: 200,
  MAX_DESCRIPTION_LENGTH: 2000,
  MAX_ITEM_DESCRIPTION_LENGTH: 500,
  MAX_NOTES_LENGTH: 1000,
  MAX_TERMS_CONDITIONS_LENGTH: 5000,
  MAX_ITEMS_PER_QUOTE: 50,
  MIN_VALID_DAYS: 1,
  MAX_VALID_DAYS: 365,
  DEFAULT_VALID_DAYS: 30,
  QUOTE_NUMBER_PREFIX: 'QT',
  QUOTE_NUMBER_LENGTH: 8
} as const;

export const GST_CONSTANTS = {
  GST_RATE: 0.10,
  GST_ENABLED_DEFAULT: true,
  GST_DECIMAL_PLACES: 2
} as const;

export const QUOTE_RATE_LIMITS = {
  CREATION: {
    WINDOW_MS: 10 * 60 * 1000,
    MAX_ATTEMPTS: 25
  },
  UPDATE: {
    WINDOW_MS: 5 * 60 * 1000,
    MAX_ATTEMPTS: 40
  },
  SEND: {
    WINDOW_MS: 15 * 60 * 1000,
    MAX_ATTEMPTS: 15
  },
  AI_PRICING: {
    WINDOW_MS: 5 * 60 * 1000,
    MAX_ATTEMPTS: 10
  },
  VIEW: {
    WINDOW_MS: 1 * 60 * 1000,
    MAX_ATTEMPTS: 50
  },
  SEARCH: {
    WINDOW_MS: 1 * 60 * 1000,
    MAX_ATTEMPTS: 30
  },
  STATUS_CHANGE: {
    WINDOW_MS: 5 * 60 * 1000,
    MAX_ATTEMPTS: 30
  },
  OPERATIONS: {
    WINDOW_MS: 10 * 60 * 1000,
    MAX_ATTEMPTS: 50
  },
  PAYMENT: {
    WINDOW_MS: 15 * 60 * 1000,
    MAX_ATTEMPTS: 10
  },
  DELIVERY: {
    WINDOW_MS: 15 * 60 * 1000,
    MAX_ATTEMPTS: 15
  }
} as const;

export const AI_PRICING_CONSTANTS = {
  MIN_JOB_DESCRIPTION_LENGTH: 10,
  MAX_JOB_DESCRIPTION_LENGTH: 2000,
  MIN_HOURLY_RATE: 10,
  MAX_HOURLY_RATE: 500,
  MIN_ESTIMATED_DURATION: 0.5,
  MAX_ESTIMATED_DURATION: 2000,
  DEFAULT_COMPLEXITY_FACTOR: 1.2,
  MIN_COMPLEXITY_FACTOR: 0.8,
  MAX_COMPLEXITY_FACTOR: 3.0,
  CONFIDENCE_THRESHOLD: 0.7,
  MARKUP_PERCENTAGE: 0.15,
  OPENAI_MODEL: 'gpt-4',
  OPENAI_MAX_TOKENS: 500,
  OPENAI_TEMPERATURE: 0.3
} as const;

export const QUOTE_VALIDATION = {
  MIN_QUANTITY: 0.01,
  MAX_QUANTITY: 99999.99,
  MIN_UNIT_PRICE: 0,
  MAX_UNIT_PRICE: 999999.99,
  MIN_TOTAL_AMOUNT: 0,
  MAX_TOTAL_AMOUNT: 9999999.99,
  DECIMAL_PLACES: 2,
  REQUIRED_FIELDS: ['title', 'clientId', 'items', 'validUntil'],
  REQUIRED_ITEM_FIELDS: ['itemType', 'description', 'quantity', 'unit', 'unitPrice']
} as const;

export const QUOTE_EXPIRY = {
  WARNING_DAYS_BEFORE: 3,
  NOTIFICATION_HOURS: [24, 48, 72],
  AUTO_EXPIRE_BUFFER_HOURS: 1,
  CLEANUP_EXPIRED_DAYS: 90
} as const;

export const QUOTE_PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
  MIN_LIMIT: 1
} as const;

export const QUOTE_SORT_OPTIONS = {
  CREATED_AT: 'created_at',
  UPDATED_AT: 'updated_at',
  TOTAL_AMOUNT: 'total_amount',
  VALID_UNTIL: 'valid_until',
  STATUS: 'status',
  QUOTE_NUMBER: 'quote_number'
} as const;

export const QUOTE_FILTER_OPTIONS = {
  STATUS: Object.values(QUOTE_STATUS),
  ITEM_TYPE: Object.values(QUOTE_ITEM_TYPE),
  DATE_RANGES: ['today', 'week', 'month', 'quarter', 'year', 'custom']
} as const;

export const QUOTE_NOTIFICATIONS = {
  TYPES: {
    QUOTE_SENT: 'quote_sent',
    QUOTE_VIEWED: 'quote_viewed',
    QUOTE_ACCEPTED: 'quote_accepted',
    QUOTE_REJECTED: 'quote_rejected',
    QUOTE_EXPIRED: 'quote_expired',
    QUOTE_EXPIRING: 'quote_expiring'
  },
  CHANNELS: {
    EMAIL: 'email',
    SMS: 'sms',
    PUSH: 'push',
    IN_APP: 'in_app'
  }
} as const;

export const QUOTE_REDIS_KEYS = {
  QUOTE_CACHE: 'quote:cache',
  QUOTE_LOCK: 'quote:lock',
  QUOTE_EXPIRY: 'quote:expiry',
  AI_PRICING_CACHE: 'ai:pricing:cache',
  QUOTE_NOTIFICATIONS: 'quote:notifications'
} as const;

export const QUOTE_EVENTS = {
  QUOTE_CREATED: 'quote.created',
  QUOTE_UPDATED: 'quote.updated',
  QUOTE_SENT: 'quote.sent',
  QUOTE_VIEWED: 'quote.viewed',
  QUOTE_ACCEPTED: 'quote.accepted',
  QUOTE_REJECTED: 'quote.rejected',
  QUOTE_EXPIRED: 'quote.expired',
  QUOTE_CANCELLED: 'quote.cancelled',
  AI_PRICING_REQUESTED: 'ai.pricing.requested',
  AI_PRICING_COMPLETED: 'ai.pricing.completed',
  QUOTE_PAYMENT_INITIATED: 'quote.payment.initiated',
  QUOTE_PAYMENT_SUCCEEDED: 'quote.payment.succeeded',
  QUOTE_PAYMENT_FAILED: 'quote.payment.failed',
  QUOTE_INVOICE_GENERATED: 'quote.invoice.generated',
  QUOTE_REFUND_PROCESSED: 'quote.refund.processed'
} as const;

export const QUOTE_ERROR_CODES = {
  QUOTE_NOT_FOUND: 'QUOTE_NOT_FOUND',
  UNAUTHORIZED_QUOTE_ACCESS: 'UNAUTHORIZED_QUOTE_ACCESS',
  QUOTE_EXPIRED: 'QUOTE_EXPIRED',
  INVALID_QUOTE_STATUS: 'INVALID_QUOTE_STATUS',
  QUOTE_VALIDATION_ERROR: 'QUOTE_VALIDATION_ERROR',
  AI_PRICING_ERROR: 'AI_PRICING_ERROR',
  QUOTE_DELIVERY_ERROR: 'QUOTE_DELIVERY_ERROR',
  QUOTE_GENERATION_ERROR: 'QUOTE_GENERATION_ERROR',
  QUOTE_PAYMENT_ERROR: 'QUOTE_PAYMENT_ERROR'
} as const;

export const MATERIAL_UNITS = {
  PIECE: 'piece',
  METER: 'meter',
  SQUARE_METER: 'square_meter',
  CUBIC_METER: 'cubic_meter',
  KILOGRAM: 'kilogram',
  LITER: 'liter',
  HOUR: 'hour',
  DAY: 'day',
  SET: 'set',
  BOX: 'box'
} as const;

export const QUOTE_STATUS_TRANSITIONS = {
  [QUOTE_STATUS.DRAFT]: [QUOTE_STATUS.SENT, QUOTE_STATUS.CANCELLED],
  [QUOTE_STATUS.SENT]: [QUOTE_STATUS.VIEWED, QUOTE_STATUS.ACCEPTED, QUOTE_STATUS.REJECTED, QUOTE_STATUS.EXPIRED, QUOTE_STATUS.CANCELLED],
  [QUOTE_STATUS.VIEWED]: [QUOTE_STATUS.ACCEPTED, QUOTE_STATUS.REJECTED, QUOTE_STATUS.EXPIRED, QUOTE_STATUS.CANCELLED],
  [QUOTE_STATUS.ACCEPTED]: [],
  [QUOTE_STATUS.REJECTED]: [],
  [QUOTE_STATUS.EXPIRED]: [],
  [QUOTE_STATUS.CANCELLED]: []
} as const;
