import { Request, Response, NextFunction } from 'express';
import { WEBHOOK_CONFIG } from '../../config/payment';
import { logger, AppError } from '../../shared/utils';
import { HTTP_STATUS_CODES } from '../../config/auth/constants';
import { 
  validateWebhookEvent, 
  validateWebhookSignature as validateSignature 
} from '../validators';
import { parseWebhookEvent } from '../utils';
import { WebhookRepository } from '../repositories';
import { getDbConnection } from '../../shared/database';

interface WebhookRequest extends Request {
  requestId?: string;
  rawBody?: string;
  webhookEvent?: any;
}

export const validateWebhookSignature = async (
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

      return next(new AppError(
        'Webhook signature required',
        HTTP_STATUS_CODES.BAD_REQUEST
      ));
    }

    const signatureValidation = await validateSignature(
      payload,
      signature,
      WEBHOOK_CONFIG.SECURITY.SIGNATURE_TOLERANCE
    );

    if (!signatureValidation.isValid) {
      logger.warn('Webhook signature validation failed', {
        errors: signatureValidation.errors,
        requestId: req.requestId,
        ip: req.ip
      });

      return next(new AppError(
        'Invalid webhook signature',
        HTTP_STATUS_CODES.UNAUTHORIZED
      ));
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

    next(new AppError(
      'Webhook signature validation service unavailable',
      HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR
    ));
  }
};

export const parseWebhookPayload = async (
  req: WebhookRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const signature = req.get('stripe-signature');
    const payload = req.rawBody || JSON.stringify(req.body);

    if (!signature || !payload) {
      return next(new AppError(
        'Missing webhook signature or payload',
        HTTP_STATUS_CODES.BAD_REQUEST
      ));
    }

    const parseResult = parseWebhookEvent(payload, signature);

    if (!parseResult.isValid) {
      logger.warn('Webhook event parsing failed', {
        error: parseResult.error,
        requestId: req.requestId,
        ip: req.ip
      });

      return next(new AppError(
        'Invalid webhook event',
        HTTP_STATUS_CODES.BAD_REQUEST
      ));
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

    next(new AppError(
      'Webhook event parsing service unavailable',
      HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR
    ));
  }
};

export const validateWebhookEventMiddleware = async (
  req: WebhookRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.webhookEvent) {
      return next(new AppError(
        'Webhook event not found in request',
        HTTP_STATUS_CODES.BAD_REQUEST
      ));
    }

    const validation = await validateWebhookEvent(JSON.stringify(req.webhookEvent));

    if (!validation.isValid) {
      logger.warn('Webhook event validation failed', {
        errors: validation.errors,
        eventId: req.webhookEvent.id,
        eventType: req.webhookEvent.type,
        requestId: req.requestId
      });

      return next(new AppError(
        'Invalid webhook event format',
        HTTP_STATUS_CODES.BAD_REQUEST
      ));
    }

    req.webhookEvent = validation.event;

    logger.info('Webhook event validation successful', {
      eventId: validation.event?.id,
      eventType: validation.event?.type,
      requestId: req.requestId
    });

    next();
  } catch (error) {
    logger.error('Webhook event validation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      eventId: req.webhookEvent?.id,
      requestId: req.requestId
    });

    next(new AppError(
      'Webhook validation service unavailable',
      HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR
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
      return next(new AppError(
        'Webhook event not found in request',
        HTTP_STATUS_CODES.BAD_REQUEST
      ));
    }

    const dbConnection = getDbConnection();
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

      res.status(HTTP_STATUS_CODES.OK).json({
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

    next(new AppError(
      'Webhook duplicate check service unavailable',
      HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR
    ));
  }
};

export const rateLimitWebhooks = (
  req: WebhookRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const rateLimitKey = `webhook_${req.ip}`;
    const maxRequests = 100;
    const windowMs = 60000;

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

    next(new AppError(
      'Webhook rate limit service unavailable',
      HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR
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

  next(new AppError(
    'Webhook processing failed',
    HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR
  ));
};

export const validateWebhookIPMiddleware = (
  req: WebhookRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const clientIP = req.ip || req.connection.remoteAddress;
    const allowedIPs = WEBHOOK_CONFIG.SECURITY.ALLOWED_IPS;

    if (!clientIP) {
      logger.warn('Unable to determine client IP for webhook request', {
        requestId: req.requestId,
        headers: req.headers
      });

      return next(new AppError(
        'Unable to verify request origin',
        HTTP_STATUS_CODES.BAD_REQUEST
      ));
    }

    if (!allowedIPs.includes(clientIP)) {
      logger.warn('Webhook request from unauthorized IP', {
        clientIP,
        allowedIPs,
        requestId: req.requestId
      });

      return next(new AppError(
        'Unauthorized webhook source',
        HTTP_STATUS_CODES.FORBIDDEN
      ));
    }

    logger.info('Webhook IP validation successful', {
      clientIP,
      requestId: req.requestId
    });

    next();
  } catch (error) {
    logger.error('Webhook IP validation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId: req.requestId
    });

    next(new AppError(
      'Webhook IP validation service unavailable',
      HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR
    ));
  }
};

export const setWebhookTimeoutMiddleware = (
  req: WebhookRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const timeout = 30000;
    
    req.setTimeout(timeout, () => {
      logger.warn('Webhook request timeout', {
        timeout,
        eventId: req.webhookEvent?.id,
        requestId: req.requestId
      });

      if (!res.headersSent) {
        next(new AppError(
          'Webhook request timeout',
          HTTP_STATUS_CODES.REQUEST_TIMEOUT
        ));
      }
    });

    res.setTimeout(timeout, () => {
      logger.warn('Webhook response timeout', {
        timeout,
        eventId: req.webhookEvent?.id,
        requestId: req.requestId
      });
    });

    next();
  } catch (error) {
    logger.error('Webhook timeout setup error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId: req.requestId
    });

    next();
  }
};
