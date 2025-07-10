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
    SIGNATURE_TOLERANCE: 300
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
    'ETIMEDOUT'
  ];

  return retryableErrors.some(errorCode => error.message.includes(errorCode));
};
