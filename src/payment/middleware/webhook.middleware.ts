import { Request, Response, NextFunction } from 'express';
import { WEBHOOK_CONFIG } from '../../config/payment';
import { logger, createErrorResponse } from '../../shared/utils';
import { validateWebhookEvent, validateWebhookSignature } from '../validators';
import { parseWebhookEvent, isWebhookEventDuplicate } from '../utils';
import { WebhookRepository } from '../repositories';
import { getDbConnection } from '../../shared/database';

interface WebhookRequest extends Request {
  requestId?: string;
  rawBody?: string;
  webhookEvent?: any;
}

export const validateWebhookSignatureMiddleware = async (
  req: WebhookRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const signature = req.get('stripe-signature');
    const payload = req.rawBody || JSON.stringify(req.body);

    if (!signature) {
      logger.warn('Webhook signature missing', {
        requestId: req.requestId,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(400).json(createErrorResponse(
        'Webhook signature required',
        'WEBHOOK_SIGNATURE_MISSING'
      ));
      return;
    }

    const signatureValidation = validateWebhookSignature({
      payload,
      signature,
      tolerance: WEBHOOK_CONFIG.SECURITY.SIGNATURE_TOLERANCE
    });

    if (!signatureValidation.isValid) {
      logger.warn('Webhook signature validation failed', {
        errors: signatureValidation.errors,
        requestId: req.requestId,
        ip: req.ip
      });

      res.status(401).json(createErrorResponse(
        'Invalid webhook signature',
        'WEBHOOK_SIGNATURE_INVALID',
        { validationErrors: signatureValidation.errors }
      ));
      return;
    }

    logger.info('Webhook signature validated successfully', {
      requestId: req.requestId,
      ip: req.ip
    });

    next();
  } catch (error) {
    logger.error('Webhook signature validation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId: req.requestId,
      ip: req.ip
    });

    res.status(500).json(createErrorResponse(
      'Webhook signature validation service unavailable',
      'WEBHOOK_SIGNATURE_SERVICE_ERROR'
    ));
  }
};

export const parseWebhookEventMiddleware = async (
  req: WebhookRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const signature = req.get('stripe-signature');
    const payload = req.rawBody || JSON.stringify(req.body);

    if (!signature || !payload) {
      res.status(400).json(createErrorResponse(
        'Missing webhook signature or payload',
        'WEBHOOK_DATA_MISSING'
      ));
      return;
    }

    const parseResult = parseWebhookEvent(payload, signature);

    if (!parseResult.isValid) {
      logger.warn('Webhook event parsing failed', {
        error: parseResult.error,
        requestId: req.requestId,
        ip: req.ip
      });

      res.status(400).json(createErrorResponse(
        'Invalid webhook event',
        'WEBHOOK_EVENT_INVALID',
        { error: parseResult.error }
      ));
      return;
    }

    req.webhookEvent = parseResult.event;

    logger.info('Webhook event parsed successfully', {
      eventId: parseResult.event?.id,
      eventType: parseResult.event?.type,
      requestId: req.requestId
    });

    next();
  } catch (error) {
    logger.error('Webhook event parsing error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId: req.requestId,
      ip: req.ip
    });

    res.status(500).json(createErrorResponse(
      'Webhook event parsing service unavailable',
      'WEBHOOK_PARSING_SERVICE_ERROR'
    ));
  }
};

export const validateWebhookEventMiddleware = (
  req: WebhookRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    if (!req.webhookEvent) {
      res.status(400).json(createErrorResponse(
        'Webhook event not found in request',
        'WEBHOOK_EVENT_MISSING'
      ));
      return;
    }

    const validation = validateWebhookEvent(req.webhookEvent);

    if (!validation.isValid) {
      logger.warn('Webhook event validation failed', {
        errors: validation.errors,
        eventId: req.webhookEvent.id,
        eventType: req.webhookEvent.type,
        requestId: req.requestId
      });

      res.status(400).json(createErrorResponse(
        'Invalid webhook event format',
        'WEBHOOK_EVENT_VALIDATION_ERROR',
        { validationErrors: validation.errors }
      ));
      return;
    }

    req.webhookEvent = validation.data;

    logger.info('Webhook event validation successful', {
      eventId: validation.data.id,
      eventType: validation.data.type,
      requestId: req.requestId
    });

    next();
  } catch (error) {
    logger.error('Webhook event validation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      eventId: req.webhookEvent?.id,
      requestId: req.requestId
    });

    res.status(500).json(createErrorResponse(
      'Webhook validation service unavailable',
      'WEBHOOK_VALIDATION_SERVICE_ERROR'
    ));
  }
};

export const checkWebhookDuplicateMiddleware = async (
  req: WebhookRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.webhookEvent) {
      res.status(400).json(createErrorResponse(
        'Webhook event not found in request',
        'WEBHOOK_EVENT_MISSING'
      ));
      return;
    }

    const dbConnection = await getDbConnection();
    const webhookRepository = new WebhookRepository(dbConnection);

    const existingEvent = await webhookRepository.getWebhookEventByStripeId(
      req.webhookEvent.id,
      req.requestId || 'unknown'
    );

    if (existingEvent) {
      logger.info('Duplicate webhook event detected', {
        eventId: req.webhookEvent.id,
        eventType: req.webhookEvent.type,
        existingEventId: existingEvent.id,
        requestId: req.requestId
      });

      res.status(200).json({
        success: true,
        message: 'Webhook event already processed',
        eventId: req.webhookEvent.id,
        processed: true
      });
      return;
    }

    logger.info('Webhook event is unique', {
      eventId: req.webhookEvent.id,
      eventType: req.webhookEvent.type,
      requestId: req.requestId
    });

    next();
  } catch (error) {
    logger.error('Webhook duplicate check error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      eventId: req.webhookEvent?.id,
      requestId: req.requestId
    });

    res.status(500).json(createErrorResponse(
      'Webhook duplicate check service unavailable',
      'WEBHOOK_DUPLICATE_CHECK_ERROR'
    ));
  }
};

export const rateLimitWebhookMiddleware = (
  req: WebhookRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const rateLimitKey = `webhook_${req.ip}`;
    const maxRequests = WEBHOOK_CONFIG.SECURITY.RATE_LIMIT.MAX_REQUESTS;
    const windowMs = WEBHOOK_CONFIG.SECURITY.RATE_LIMIT.WINDOW_MS;

    logger.info('Webhook rate limit check', {
      ip: req.ip,
      maxRequests,
      windowMs,
      requestId: req.requestId
    });

    next();
  } catch (error) {
    logger.error('Webhook rate limit error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: req.ip,
      requestId: req.requestId
    });

    res.status(500).json(createErrorResponse(
      'Webhook rate limit service unavailable',
      'WEBHOOK_RATE_LIMIT_ERROR'
    ));
  }
};

export const logWebhookEventMiddleware = (
  req: WebhookRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const eventData = req.webhookEvent;

    if (eventData) {
      logger.info('Webhook event received', {
        eventId: eventData.id,
        eventType: eventData.type,
        created: new Date(eventData.created * 1000).toISOString(),
        livemode: eventData.livemode,
        apiVersion: eventData.api_version,
        pendingWebhooks: eventData.pending_webhooks,
        requestId: req.requestId,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
    }

    const originalSend = res.json;
    res.json = function(body: any) {
      logger.info('Webhook response sent', {
        eventId: eventData?.id,
        eventType: eventData?.type,
        statusCode: res.statusCode,
        responseBody: body,
        requestId: req.requestId
      });

      return originalSend.call(this, body);
    };

    next();
  } catch (error) {
    logger.error('Webhook logging error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      eventId: req.webhookEvent?.id,
      requestId: req.requestId
    });

    next();
  }
};

export const handleWebhookErrorMiddleware = (
  error: Error,
  req: WebhookRequest,
  res: Response,
  next: NextFunction
): void => {
  logger.error('Webhook processing error', {
    error: error.message,
    stack: error.stack,
    eventId: req.webhookEvent?.id,
    eventType: req.webhookEvent?.type,
    requestId: req.requestId,
    ip: req.ip
  });

  if (res.headersSent) {
    return next(error);
  }

  res.status(500).json(createErrorResponse(
    'Webhook processing failed',
    'WEBHOOK_PROCESSING_ERROR',
    { eventId: req.webhookEvent?.id }
  ));
};
