export const PAYMENT_CONSTANTS = {
  STRIPE: {
    API_VERSION: '2023-10-16',
    WEBHOOK_TOLERANCE: 300,
    MAX_NETWORK_RETRIES: 3,
    TIMEOUT: 30000,
    CURRENCY: {
      DEFAULT: 'AUD',
      SUPPORTED: ['AUD', 'USD']
    },
    LIMITS: {
      MIN_AMOUNT: 50,
      MAX_AMOUNT: 10000000
    }
  },
  
  PAYMENT_METHODS: {
    STRIPE_CARD: 'stripe_card',
    APPLE_PAY: 'apple_pay',
    GOOGLE_PAY: 'google_pay'
  },

  APPLE_PAY: {
    MERCHANT_ID: process.env.APPLE_PAY_MERCHANT_ID || 'merchant.com.buildhive',
    DOMAIN_NAME: process.env.APPLE_PAY_DOMAIN || 'buildhive.com',
    DISPLAY_NAME: 'BuildHive',
    SUPPORTED_NETWORKS: ['visa', 'masterCard', 'amex'],
    MERCHANT_CAPABILITIES: ['supports3DS', 'supportsCredit', 'supportsDebit'],
    SUPPORTED_COUNTRIES: ['AU', 'US', 'CA', 'GB']  
  },

  GOOGLE_PAY: {
    MERCHANT_ID: process.env.GOOGLE_PAY_MERCHANT_ID || '12345678901234567890',
    MERCHANT_NAME: 'BuildHive',
    GATEWAY: 'stripe',
    SUPPORTED_NETWORKS: ['VISA', 'MASTERCARD', 'AMEX'],
    SUPPORTED_METHODS: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
    SUPPORTED_COUNTRIES: ['AU', 'US', 'CA', 'GB']  
  },

  DATABASE: {
    TABLES: {
      PAYMENTS: 'payments',
      PAYMENT_METHODS: 'payment_methods',
      WEBHOOK_EVENTS: 'webhook_events',
      INVOICES: 'invoices',
      REFUNDS: 'refunds'
    }
  },

  LIMITS: {
    MIN_AMOUNT: 50,
    MAX_AMOUNT: 10000000,
    MAX_REFUND_DAYS: 90,
    MAX_PAYMENT_METHODS_PER_USER: 10
  },

  WEBHOOK: {
    EVENTS: [
      'payment_intent.succeeded',
      'payment_intent.payment_failed',
      'payment_method.attached',
      'charge.dispute.created'
    ],
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000,
    MAX_BODY_SIZE: '1mb'
  },

  ERROR_CODES: {
    PAYMENT_NOT_FOUND: 'PAYMENT_NOT_FOUND',
    PAYMENT_PROCESSING_ERROR: 'PAYMENT_PROCESSING_ERROR',
    STRIPE_ERROR: 'STRIPE_ERROR',
    WEBHOOK_VALIDATION_ERROR: 'WEBHOOK_VALIDATION_ERROR',
    PAYMENT_METHOD_NOT_FOUND: 'PAYMENT_METHOD_NOT_FOUND',
    INVALID_PAYMENT_AMOUNT: 'INVALID_PAYMENT_AMOUNT',
    INVALID_CURRENCY: 'INVALID_CURRENCY'
  }
};
