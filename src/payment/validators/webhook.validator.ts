import Joi from 'joi';
import crypto from 'crypto';
import { WEBHOOK_CONFIG } from '../../config/payment';
import { WebhookEventType } from '../../shared/types';
import { WebhookValidationResult } from '../types';

export const webhookEventSchema = Joi.object({
  id: Joi.string()
    .pattern(/^evt_[a-zA-Z0-9_]+$/)
    .required()
    .messages({
      'string.base': 'Event ID must be a string',
      'string.pattern.base': 'Event ID must be a valid Stripe event ID',
      'any.required': 'Event ID is required'
    }),

  object: Joi.string()
    .valid('event')
    .required()
    .messages({
      'string.base': 'Object must be a string',
      'any.only': 'Object must be "event"',
      'any.required': 'Object is required'
    }),

  api_version: Joi.string()
    .required()
    .messages({
      'string.base': 'API version must be a string',
      'any.required': 'API version is required'
    }),

  created: Joi.number()
    .integer()
    .positive()
    .required()
    .messages({
      'number.base': 'Created timestamp must be a number',
      'number.integer': 'Created timestamp must be an integer',
      'number.positive': 'Created timestamp must be positive',
      'any.required': 'Created timestamp is required'
    }),

  data: Joi.object({
    object: Joi.object().required(),
    previous_attributes: Joi.object().optional()
  }).required()
    .messages({
      'object.base': 'Data must be an object',
      'any.required': 'Data is required'
    }),

  livemode: Joi.boolean()
    .required()
    .messages({
      'boolean.base': 'Livemode must be a boolean',
      'any.required': 'Livemode is required'
    }),

  pending_webhooks: Joi.number()
    .integer()
    .min(0)
    .required()
    .messages({
      'number.base': 'Pending webhooks must be a number',
      'number.integer': 'Pending webhooks must be an integer',
      'number.min': 'Pending webhooks cannot be negative',
      'any.required': 'Pending webhooks is required'
    }),

  request: Joi.object({
    id: Joi.string().required(),
    idempotency_key: Joi.string().optional()
  }).required()
    .messages({
      'object.base': 'Request must be an object',
      'any.required': 'Request is required'
    }),

  type: Joi.string()
    .valid(...WEBHOOK_CONFIG.STRIPE.EVENTS)
    .required()
    .messages({
      'string.base': 'Event type must be a string',
      'any.only': `Event type must be one of: ${WEBHOOK_CONFIG.STRIPE.EVENTS.join(', ')}`,
      'any.required': 'Event type is required'
    })
});

export const webhookSignatureSchema = Joi.object({
  payload: Joi.string()
    .required()
    .messages({
      'string.base': 'Payload must be a string',
      'any.required': 'Payload is required'
    }),

  signature: Joi.string()
    .pattern(/^t=\d+,v1=[a-f0-9]+/)
    .required()
    .messages({
      'string.base': 'Signature must be a string',
      'string.pattern.base': 'Signature must be a valid Stripe webhook signature',
      'any.required': 'Signature is required'
    }),

  tolerance: Joi.number()
    .integer()
    .min(0)
    .max(3600)
    .optional()
    .default(WEBHOOK_CONFIG.SECURITY.SIGNATURE_TOLERANCE)
    .messages({
      'number.base': 'Tolerance must be a number',
      'number.integer': 'Tolerance must be an integer',
      'number.min': 'Tolerance cannot be negative',
      'number.max': 'Tolerance cannot exceed 3600 seconds'
    })
});

export const webhookProcessingSchema = Joi.object({
  eventId: Joi.string()
    .pattern(/^evt_[a-zA-Z0-9_]+$/)
    .required()
    .messages({
      'string.base': 'Event ID must be a string',
      'string.pattern.base': 'Event ID must be a valid Stripe event ID',
      'any.required': 'Event ID is required'
    }),

  eventType: Joi.string()
    .valid(...Object.values(WebhookEventType))
    .required()
    .messages({
      'string.base': 'Event type must be a string',
      'any.only': `Event type must be one of: ${Object.values(WebhookEventType).join(', ')}`,
      'any.required': 'Event type is required'
    }),

  data: Joi.object()
    .required()
    .messages({
      'object.base': 'Data must be an object',
      'any.required': 'Data is required'
    }),

  processed: Joi.boolean()
    .optional()
    .default(false)
    .messages({
      'boolean.base': 'Processed must be a boolean'
    }),

  retryCount: Joi.number()
    .integer()
    .min(0)
    .max(WEBHOOK_CONFIG.STRIPE.RETRY_CONFIG.MAX_ATTEMPTS)
    .optional()
    .default(0)
    .messages({
      'number.base': 'Retry count must be a number',
      'number.integer': 'Retry count must be an integer',
      'number.min': 'Retry count cannot be negative',
      'number.max': `Retry count cannot exceed ${WEBHOOK_CONFIG.STRIPE.RETRY_CONFIG.MAX_ATTEMPTS}`
    })
});

const isSupportedWebhookEvent = (eventType: string): boolean => {
  return WEBHOOK_CONFIG.STRIPE.EVENTS.includes(eventType);
};

const verifyWebhookSignature = (payload: string, signature: string, secret: string, tolerance: number = 300): boolean => {
  try {
    const elements = signature.split(',');
    const timestamp = elements.find(el => el.startsWith('t='))?.split('=')[1];
    const signatures = elements.filter(el => el.startsWith('v1='));

    if (!timestamp || signatures.length === 0) {
      return false;
    }

    const timestampNum = parseInt(timestamp, 10);
    const currentTime = Math.floor(Date.now() / 1000);

    if (Math.abs(currentTime - timestampNum) > tolerance) {
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${payload}`)
      .digest('hex');

    return signatures.some(sig => {
      const providedSignature = sig.split('=')[1];
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(providedSignature, 'hex')
      );
    });
  } catch (error) {
    return false;
  }
};

export const validateWebhookEvent = async (payload: string): Promise<WebhookValidationResult> => {
  try {
    const event = JSON.parse(payload);
    
    const { error, value } = webhookEventSchema.validate(event, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const validationErrors = error.details.map(detail => detail.message);
      
      return {
        isValid: false,
        errors: validationErrors
      };
    }

    const customValidation = validateWebhookBusinessRules(value);
    if (!customValidation.isValid) {
      return customValidation;
    }

    return {
      isValid: true,
      event: value
    };
  } catch (error) {
    return {
      isValid: false,
      errors: ['Invalid JSON payload']
    };
  }
};

export const validateWebhookSignature = (
  payload: string,
  signature: string,
  secret: string
): boolean => {
  const data = { payload, signature };
  
  const { error, value } = webhookSignatureSchema.validate(data, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    return false;
  }

  return verifyWebhookSignature(
    value.payload,
    value.signature,
    secret,
    value.tolerance
  );
};

export const validateWebhookProcessing = (data: any) => {
  const { error, value } = webhookProcessingSchema.validate(data, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const validationErrors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));
    
    return {
      isValid: false,
      errors: validationErrors,
      data: null
    };
  }

  return {
    isValid: true,
    errors: [],
    data: value
  };
};

const validateWebhookBusinessRules = (data: any): WebhookValidationResult => {
  if (!isSupportedWebhookEvent(data.type)) {
    return {
      isValid: false,
      errors: ['Unsupported webhook event type']
    };
  }

  const eventAge = Date.now() - (data.created * 1000);
  const maxAge = 24 * 60 * 60 * 1000;
  
  if (eventAge > maxAge) {
    return {
      isValid: false,
      errors: ['Webhook event is too old']
    };
  }

  return {
    isValid: true
  };
};
