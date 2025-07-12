export const WEBHOOK_CONFIG = {
  STRIPE: {
    ENDPOINT_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
    EVENTS: [
      'payment_intent.succeeded',
      'payment_intent.payment_failed',
      'payment_intent.requires_action',
      'payment_method.attached',
      'charge.dispute.created',
      'charge.failed'
    ],
    RETRY_CONFIG: {
      MAX_ATTEMPTS: 3,
      INITIAL_DELAY: 1000,
      MAX_DELAY: 10000,
      BACKOFF_MULTIPLIER: 2
    }
  },

  PROCESSING: {
    BATCH_SIZE: 10,
    PROCESSING_TIMEOUT: 30000,
    DEAD_LETTER_THRESHOLD: 5
  },

  SECURITY: {
    ALLOWED_IPS: [
      '3.18.12.63',
      '3.130.192.231',
      '13.235.14.237',
      '13.235.122.149',
      '18.211.135.69',
      '35.154.171.200',
      '52.15.183.38',
      '54.88.130.119',
      '54.88.130.237',
      '54.187.174.169',
      '54.187.205.235',
      '54.187.216.72'
    ],
    SIGNATURE_TOLERANCE: 300,
    RATE_LIMIT: {
      MAX_REQUESTS: 100,
      WINDOW_MS: 60000,
      SKIP_FAILED_REQUESTS: true,
      SKIP_SUCCESSFUL_REQUESTS: false,
      KEY_GENERATOR: (req: any) => `webhook_${req.ip}`,
      HEADERS: true,
      MESSAGE: 'Too many webhook requests from this IP'
    }
  },

  MONITORING: {
    ENABLE_METRICS: true,
    METRICS_INTERVAL: 60000,
    LOG_FAILED_EVENTS: true,
    ALERT_THRESHOLD: 10
  },

  VALIDATION: {
    STRICT_MODE: true,
    VALIDATE_TIMESTAMP: true,
    MAX_EVENT_AGE: 86400000,
    REQUIRE_HTTPS: process.env.NODE_ENV === 'production'
  }
};

export const getWebhookEventHandlers = (): Record<string, string> => {
  return {
    'payment_intent.succeeded': 'handlePaymentSucceeded',
    'payment_intent.payment_failed': 'handlePaymentFailed',
    'payment_intent.requires_action': 'handlePaymentRequiresAction',
    'payment_method.attached': 'handlePaymentMethodAttached',
    'charge.dispute.created': 'handleChargeDispute',
    'charge.failed': 'handleChargeFailed'
  };
};

export const getWebhookEventPriorities = (): Record<string, number> => {
  return {
    'payment_intent.succeeded': 1,
    'payment_intent.payment_failed': 1,
    'charge.dispute.created': 2,
    'payment_intent.requires_action': 3,
    'payment_method.attached': 4,
    'charge.failed': 5
  };
};

export const isValidWebhookIP = (ip: string): boolean => {
  return WEBHOOK_CONFIG.SECURITY.ALLOWED_IPS.includes(ip);
};

export const calculateRetryDelay = (attempt: number): number => {
  const { INITIAL_DELAY, MAX_DELAY, BACKOFF_MULTIPLIER } = WEBHOOK_CONFIG.STRIPE.RETRY_CONFIG;
  const delay = INITIAL_DELAY * Math.pow(BACKOFF_MULTIPLIER, attempt - 1);
  return Math.min(delay, MAX_DELAY);
};

export const shouldRetryWebhook = (attempt: number, error: Error): boolean => {
  const { MAX_ATTEMPTS } = WEBHOOK_CONFIG.STRIPE.RETRY_CONFIG;
  
  if (attempt >= MAX_ATTEMPTS) {
    return false;
  }

  const retryableErrors = [
    'ECONNRESET',
    'ENOTFOUND',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'NETWORK_ERROR',
    'DATABASE_ERROR',
    'TIMEOUT_ERROR'
  ];

  return retryableErrors.some(errorCode => error.message.toUpperCase().includes(errorCode));
};

export const isRetryableWebhookError = (error: Error): boolean => {
  const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
  const errorMessage = error.message.toLowerCase();
  
  return retryableStatusCodes.some(code => errorMessage.includes(code.toString())) ||
         errorMessage.includes('timeout') ||
         errorMessage.includes('connection') ||
         errorMessage.includes('network');
};

export const getWebhookTimeout = (): number => {
  return WEBHOOK_CONFIG.PROCESSING.PROCESSING_TIMEOUT;
};

export const isWebhookEventSupported = (eventType: string): boolean => {
  return WEBHOOK_CONFIG.STRIPE.EVENTS.includes(eventType);
};

export const getWebhookBatchSize = (): number => {
  return WEBHOOK_CONFIG.PROCESSING.BATCH_SIZE;
};

export const getDeadLetterThreshold = (): number => {
  return WEBHOOK_CONFIG.PROCESSING.DEAD_LETTER_THRESHOLD;
};

export const validateWebhookConfig = (): boolean => {
  try {
    if (!WEBHOOK_CONFIG.STRIPE.ENDPOINT_SECRET) {
      console.warn('STRIPE_WEBHOOK_SECRET environment variable not set');
      return false;
    }

    if (WEBHOOK_CONFIG.STRIPE.EVENTS.length === 0) {
      console.warn('No webhook events configured');
      return false;
    }

    if (WEBHOOK_CONFIG.SECURITY.ALLOWED_IPS.length === 0) {
      console.warn('No allowed IPs configured for webhooks');
      return false;
    }

    return true;
  } catch (error) {
    console.error('Webhook configuration validation failed:', error);
    return false;
  }
};
