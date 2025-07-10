import { Request, Response } from 'express';
import { logger, createSuccessResponse, createErrorResponse } from '../../shared/utils';
import { WebhookService } from '../services';

interface WebhookRequest extends Request {
  requestId?: string;
  rawBody?: Buffer;
}

export class WebhookController {
  private webhookService: WebhookService;

  constructor() {
    this.webhookService = new WebhookService();
  }

  async handleStripeWebhook(req: WebhookRequest, res: Response): Promise<void> {
    try {
      const requestId = req.requestId || 'unknown';
      const signature = req.get('stripe-signature');
      const payload = req.rawBody ? req.rawBody.toString() : JSON.stringify(req.body);

      if (!signature) {
        res.status(400).json(createErrorResponse(
          'Missing Stripe signature',
          'WEBHOOK_SIGNATURE_MISSING'
        ));
        return;
      }

      if (!payload) {
        res.status(400).json(createErrorResponse(
          'Missing webhook payload',
          'WEBHOOK_PAYLOAD_MISSING'
        ));
        return;
      }

      const processingResult = await this.webhookService.processWebhookEvent(
        payload,
        signature,
        requestId
      );

      if (!processingResult.success) {
        logger.error('Webhook processing failed', {
          eventId: processingResult.eventId,
          message: processingResult.message,
          requestId
        });

        res.status(400).json(createErrorResponse(
          processingResult.message,
          'WEBHOOK_PROCESSING_FAILED'
        ));
        return;
      }

      logger.info('Webhook processed successfully', {
        eventId: processingResult.eventId,
        processed: processingResult.processed,
        message: processingResult.message,
        requestId
      });

      res.status(200).json(createSuccessResponse(
        'Webhook processed successfully',
        {
          eventId: processingResult.eventId,
          processed: processingResult.processed
        }
      ));
    } catch (error) {
      logger.error('Webhook processing error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: req.requestId
      });

      res.status(500).json(createErrorResponse(
        'Internal webhook processing error',
        'WEBHOOK_INTERNAL_ERROR'
      ));
    }
  }

  async retryWebhookEvent(req: WebhookRequest, res: Response): Promise<void> {
    try {
      const requestId = req.requestId || 'unknown';
      const eventId = parseInt(req.params.eventId);

      if (isNaN(eventId)) {
        res.status(400).json(createErrorResponse(
          'Invalid webhook event ID',
          'INVALID_WEBHOOK_EVENT_ID'
        ));
        return;
      }

      const retryResult = await this.webhookService.retryFailedWebhookEvent(eventId, requestId);

      if (!retryResult.success) {
        logger.error('Webhook retry failed', {
          eventId,
          message: retryResult.message,
          requestId
        });

        const statusCode = retryResult.message.includes('not found') ? 404 :
                          retryResult.message.includes('Maximum retry') ? 429 : 400;

        res.status(statusCode).json(createErrorResponse(
          retryResult.message,
          'WEBHOOK_RETRY_FAILED'
        ));
        return;
      }

      logger.info('Webhook retry processed successfully', {
        eventId,
        stripeEventId: retryResult.eventId,
        processed: retryResult.processed,
        requestId
      });

      res.status(200).json(createSuccessResponse(
        'Webhook retry processed successfully',
        {
          eventId,
          stripeEventId: retryResult.eventId,
          processed: retryResult.processed
        }
      ));
    } catch (error) {
      logger.error('Webhook retry error', {
        eventId: req.params.eventId,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: req.requestId
      });

      res.status(500).json(createErrorResponse(
        'Internal webhook retry error',
        'WEBHOOK_RETRY_INTERNAL_ERROR'
      ));
    }
  }

  async getWebhookHealth(req: WebhookRequest, res: Response): Promise<void> {
    try {
      const requestId = req.requestId || 'unknown';

      const healthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        webhook: {
          endpoint: '/api/payments/webhooks/stripe',
          methods: ['POST'],
          authentication: 'stripe-signature'
        },
        environment: process.env.NODE_ENV || 'development'
      };

      logger.info('Webhook health check', {
        status: healthStatus.status,
        requestId
      });

      res.status(200).json(createSuccessResponse(
        'Webhook service is healthy',
        healthStatus
      ));
    } catch (error) {
      logger.error('Webhook health check error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: req.requestId
      });

      res.status(500).json(createErrorResponse(
        'Webhook health check failed',
        'WEBHOOK_HEALTH_CHECK_FAILED'
      ));
    }
  }

  async validateWebhookEndpoint(req: WebhookRequest, res: Response): Promise<void> {
    try {
      const requestId = req.requestId || 'unknown';

      const validationResult = {
        endpoint: req.originalUrl,
        method: req.method,
        headers: {
          'content-type': req.get('content-type'),
          'stripe-signature': req.get('stripe-signature') ? 'present' : 'missing',
          'user-agent': req.get('user-agent')
        },
        timestamp: new Date().toISOString(),
        valid: true
      };

      logger.info('Webhook endpoint validation', {
        endpoint: validationResult.endpoint,
        method: validationResult.method,
        valid: validationResult.valid,
        requestId
      });

      res.status(200).json(createSuccessResponse(
        'Webhook endpoint validation successful',
        validationResult
      ));
    } catch (error) {
      logger.error('Webhook endpoint validation error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: req.requestId
      });

      res.status(500).json(createErrorResponse(
        'Webhook endpoint validation failed',
        'WEBHOOK_VALIDATION_FAILED'
      ));
    }
  }

  async getWebhookConfiguration(req: WebhookRequest, res: Response): Promise<void> {
    try {
      const requestId = req.requestId || 'unknown';

      const configuration = {
        webhookEndpoint: `${process.env.API_BASE_URL}/api/payments/webhooks/stripe`,
        supportedEvents: [
          'payment_intent.succeeded',
          'payment_intent.payment_failed',
          'payment_intent.canceled',
          'payment_method.attached',
          'charge.dispute.created',
          'invoice.payment_succeeded',
          'invoice.payment_failed'
        ],
        signatureVerification: 'required',
        retryPolicy: {
          maxAttempts: 3,
          backoffStrategy: 'exponential'
        },
        timeout: '30s'
      };

      logger.info('Webhook configuration retrieved', {
        endpoint: configuration.webhookEndpoint,
        eventsCount: configuration.supportedEvents.length,
        requestId
      });

      res.status(200).json(createSuccessResponse(
        'Webhook configuration retrieved successfully',
        configuration
      ));
    } catch (error) {
      logger.error('Webhook configuration retrieval error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: req.requestId
      });

      res.status(500).json(createErrorResponse(
        'Failed to get webhook configuration',
        'WEBHOOK_CONFIG_RETRIEVAL_FAILED'
      ));
    }
  }
}
