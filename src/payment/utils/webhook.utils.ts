import crypto from 'crypto';
import { WEBHOOK_CONFIG } from '../../config/payment';
import { WebhookEventType } from '../../shared/types';
import { StripeWebhookEvent, WebhookValidationResult, WebhookSignatureValidation } from '../types';

export const validateWebhookSignature = (
  payload: string,
  signature: string,
  secret: string,
  tolerance: number = WEBHOOK_CONFIG.SECURITY.SIGNATURE_TOLERANCE
): boolean => {
  const elements = signature.split(',');
  
  let timestamp: number | null = null;
  const signatures: string[] = [];
  
  for (const element of elements) {
    const [key, value] = element.split('=');
    
    if (key === 't') {
      timestamp = parseInt(value, 10);
    } else if (key === 'v1') {
      signatures.push(value);
    }
  }
  
  if (!timestamp || signatures.length === 0) {
    return false;
  }
  
  const currentTime = Math.floor(Date.now() / 1000);
  if (currentTime - timestamp > tolerance) {
    return false;
  }
  
  const payloadForSigning = `${timestamp}.${payload}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payloadForSigning, 'utf8')
    .digest('hex');
  
  return signatures.some(signature => 
    crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    )
  );
};

export const parseWebhookEvent = (payload: string, signature: string): WebhookValidationResult => {
  const secret = WEBHOOK_CONFIG.STRIPE.ENDPOINT_SECRET;
  
  if (!secret) {
    return {
      isValid: false,
      error: 'Webhook secret not configured'
    };
  }
  
  try {
    const isValidSignature = validateWebhookSignature(payload, signature, secret);
    
    if (!isValidSignature) {
      return {
        isValid: false,
        error: 'Invalid webhook signature'
      };
    }
    
    const event: StripeWebhookEvent = JSON.parse(payload);
    
    if (!isValidWebhookEvent(event)) {
      return {
        isValid: false,
        error: 'Invalid webhook event format'
      };
    }
    
    return {
      isValid: true,
      event
    };
  } catch (error) {
    return {
      isValid: false,
      error: `Failed to parse webhook: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
};

export const isValidWebhookEvent = (event: any): event is StripeWebhookEvent => {
  return (
    event &&
    typeof event === 'object' &&
    typeof event.id === 'string' &&
    typeof event.type === 'string' &&
    typeof event.created === 'number' &&
    event.data &&
    typeof event.data === 'object'
  );
};

export const isSupportedWebhookEvent = (eventType: string): boolean => {
  return WEBHOOK_CONFIG.STRIPE.EVENTS.includes(eventType);
};

export const extractWebhookEventType = (stripeEventType: string): WebhookEventType | null => {
  const eventTypeMap: Record<string, WebhookEventType> = {
    'payment_intent.succeeded': WebhookEventType.PAYMENT_SUCCEEDED,
    'payment_intent.payment_failed': WebhookEventType.PAYMENT_FAILED,
    'charge.dispute.created': WebhookEventType.REFUND_CREATED
  };
  
  return eventTypeMap[stripeEventType] || null;
};

export const shouldRetryWebhookProcessing = (
  attempt: number,
  error: Error
): boolean => {
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
    'DATABASE_ERROR'
  ];
  
  const errorMessage = error.message.toUpperCase();
  return retryableErrors.some(retryableError => 
    errorMessage.includes(retryableError)
  );
};

export const calculateWebhookRetryDelay = (attempt: number): number => {
  const { INITIAL_DELAY, MAX_DELAY, BACKOFF_MULTIPLIER } = WEBHOOK_CONFIG.STRIPE.RETRY_CONFIG;
  
  const delay = INITIAL_DELAY * Math.pow(BACKOFF_MULTIPLIER, attempt - 1);
  return Math.min(delay, MAX_DELAY);
};

export const generateWebhookEventId = (stripeEventId: string, eventType: string): string => {
  const timestamp = Date.now();
  const hash = crypto
    .createHash('sha256')
    .update(`${stripeEventId}-${eventType}-${timestamp}`)
    .digest('hex')
    .substring(0, 8);
  
  return `wh_${hash}_${timestamp}`;
};

export const sanitizeWebhookData = (data: any): Record<string, any> => {
  if (!data || typeof data !== 'object') {
    return {};
  }
  
  const sanitized: Record<string, any> = {};
  const maxDepth = 5;
  const maxStringLength = 1000;
  
  const sanitizeValue = (value: any, depth: number): any => {
    if (depth > maxDepth) {
      return '[MAX_DEPTH_EXCEEDED]';
    }
    
    if (value === null || value === undefined) {
      return value;
    }
    
    if (typeof value === 'string') {
      return value.length > maxStringLength 
        ? value.substring(0, maxStringLength) + '...'
        : value;
    }
    
    if (typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }
    
    if (Array.isArray(value)) {
      return value.slice(0, 100).map(item => sanitizeValue(item, depth + 1));
    }
    
    if (typeof value === 'object') {
      const sanitizedObject: Record<string, any> = {};
      let keyCount = 0;
      
      for (const [key, val] of Object.entries(value)) {
        if (keyCount >= 50) break;
        
        const sanitizedKey = key.replace(/[^a-zA-Z0-9_]/g, '').substring(0, 50);
        if (sanitizedKey) {
          sanitizedObject[sanitizedKey] = sanitizeValue(val, depth + 1);
          keyCount++;
        }
      }
      
      return sanitizedObject;
    }
    
    return String(value).substring(0, maxStringLength);
  };
  
  return sanitizeValue(data, 0);
};

export const isWebhookEventDuplicate = (
  eventId: string,
  existingEventIds: string[]
): boolean => {
  return existingEventIds.includes(eventId);
};

export const getWebhookEventPriority = (eventType: string): number => {
  const priorityMap: Record<string, number> = {
    'payment_intent.succeeded': 1,
    'payment_intent.payment_failed': 1,
    'charge.dispute.created': 2,
    'payment_method.attached': 3
  };
  
  return priorityMap[eventType] || 5;
};

export const formatWebhookEventForLogging = (event: StripeWebhookEvent): {
  eventId: string;
  eventType: string;
  created: string;
  objectId: string;
  livemode: boolean;
} => {
  return {
    eventId: event.id,
    eventType: event.type,
    created: new Date(event.created * 1000).toISOString(),
    objectId: event.data.object?.id || 'unknown',
    livemode: event.livemode
  };
};
