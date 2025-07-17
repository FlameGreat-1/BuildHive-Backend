import { Request, Response } from 'express';
import { logger, sendSuccessResponse, sendErrorResponse } from '../../shared/utils';
import { WebhookService } from '../services';
import { validateWebhookEvent, validateWebhookSignature } from '../validators/webhook.validator';
import { WebhookEventRequest } from '../types';

interface WebhookRequest extends Request {
  requestId?: string;
  rawBody?: string;
}

export class WebhookController {
  private webhookService: WebhookService;

  constructor() {
    this.webhookService = new WebhookService();
  }

  async handleStripeWebhook(req: WebhookRequest, res: Response): Promise<void> {
    try {
      const requestId = req.requestId || 'webhook-unknown';
      const signature = req.headers['stripe-signature'] as string;
      const payload = req.rawBody || JSON.stringify(req.body);

      if (!signature) {
        sendErrorResponse(res, 'Missing stripe-signature header', 400);
        return;
      }

      logger.info('Processing Stripe webhook', {
        eventType: req.body?.type,
        eventId: req.body?.id,
        requestId
      });

      const signatureValid = validateWebhookSignature(payload, signature);

      if (!signatureValid) {
        logger.warn('Invalid webhook signature', {
          eventId: req.body?.id,
          requestId
        });
        sendErrorResponse(res, 'Invalid webhook signature', 400);
        return;
      }

      const validationResult = await validateWebhookEvent(req.body);

      if (!validationResult.isValid) {
        logger.warn('Invalid webhook event', {
          errors: validationResult.errors,
          eventId: req.body?.id,
          requestId
        });
        sendErrorResponse(res, 'Invalid webhook event', 400);
        return;
      }

      const result = await this.webhookService.processWebhookEvent(payload, signature);

      logger.info('Webhook processed successfully', {
        eventId: req.body.id,
        eventType: req.body.type,
        processed: result.processed,
        requestId
      });

      sendSuccessResponse(res, 'Webhook processed successfully', result);

    } catch (error) {
      logger.error('Webhook processing error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        eventId: req.body?.id,
        eventType: req.body?.type,
        requestId: req.requestId || 'unknown'
      });

      sendErrorResponse(res, 'Failed to process webhook', 500);
    }
  }

  async getWebhookEvent(req: WebhookRequest, res: Response): Promise<void> {
    try {
      const requestId = req.requestId || 'get-webhook-unknown';
      const eventId = req.params.eventId;

      if (!eventId) {
        sendErrorResponse(res, 'Event ID is required', 400);
        return;
      }

      logger.info('Retrieving webhook event', {
        eventId,
        requestId
      });

      const webhookEvent = await this.webhookService.getWebhookEvent(eventId);

      if (!webhookEvent) {
        sendErrorResponse(res, 'Webhook event not found', 404);
        return;
      }

      sendSuccessResponse(res, 'Webhook event retrieved successfully', webhookEvent);

    } catch (error) {
      logger.error('Failed to get webhook event', {
        error: error instanceof Error ? error.message : 'Unknown error',
        eventId: req.params.eventId,
        requestId: req.requestId || 'unknown'
      });

      sendErrorResponse(res, 'Failed to get webhook event', 500);
    }
  }

  async listWebhookEvents(req: WebhookRequest, res: Response): Promise<void> {
    try {
      const requestId = req.requestId || 'list-webhooks-unknown';
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const eventType = req.query.eventType as string;
      const processed = req.query.processed === 'true' ? true : 
                       req.query.processed === 'false' ? false : undefined;

      logger.info('Listing webhook events', {
        limit,
        offset,
        eventType,
        processed,
        requestId
      });

      const webhookEvents = await this.webhookService.listWebhookEvents({
        limit,
        offset,
        eventType,
        processed
      });

      sendSuccessResponse(res, 'Webhook events retrieved successfully', webhookEvents);

    } catch (error) {
      logger.error('Failed to list webhook events', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: req.requestId || 'unknown'
      });

      sendErrorResponse(res, 'Failed to list webhook events', 500);
    }
  }

  async retryWebhookEvent(req: WebhookRequest, res: Response): Promise<void> {
    try {
      const requestId = req.requestId || 'retry-webhook-unknown';
      const eventId = req.params.eventId;

      if (!eventId) {
        sendErrorResponse(res, 'Event ID is required', 400);
        return;
      }

      logger.info('Retrying webhook event', {
        eventId,
        requestId
      });

      const retryResult = await this.webhookService.retryWebhookEvent(eventId);

      logger.info('Webhook event retried successfully', {
        eventId,
        processed: retryResult.processed,
        requestId
      });

      sendSuccessResponse(res, 'Webhook event retried successfully', retryResult);

    } catch (error) {
      logger.error('Failed to retry webhook event', {
        error: error instanceof Error ? error.message : 'Unknown error',
        eventId: req.params.eventId,
        requestId: req.requestId || 'unknown'
      });

      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 :
                        error instanceof Error && error.message.includes('already processed') ? 400 :
                        error instanceof Error && error.message.includes('retry limit') ? 400 : 500;
      sendErrorResponse(res,
        error instanceof Error ? error.message : 'Failed to retry webhook event',
        statusCode
      );
    }
  }

  async getWebhookStats(req: WebhookRequest, res: Response): Promise<void> {
    try {
      const requestId = req.requestId || 'webhook-stats-unknown';
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      logger.info('Retrieving webhook statistics', {
        startDate,
        endDate,
        requestId
      });

      const stats = await this.webhookService.getWebhookStats({
        startDate,
        endDate
      });

      sendSuccessResponse(res, 'Webhook statistics retrieved successfully', stats);

    } catch (error) {
      logger.error('Failed to get webhook statistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: req.requestId || 'unknown'
      });

      sendErrorResponse(res, 'Failed to get webhook statistics', 500);
    }
  }

  async getWebhookHealth(req: WebhookRequest, res: Response): Promise<void> {
    try {
      const requestId = req.requestId || 'webhook-health-unknown';

      logger.info('Checking webhook health', {
        requestId
      });

      const healthStatus = await this.webhookService.getWebhookHealth();

      sendSuccessResponse(res, 'Webhook health retrieved successfully', healthStatus);

    } catch (error) {
      logger.error('Failed to get webhook health', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: req.requestId || 'unknown'
      });

      sendErrorResponse(res, 'Failed to get webhook health', 500);
    }
  }

  async validateWebhookEndpoint(req: WebhookRequest, res: Response): Promise<void> {
    try {
      const requestId = req.requestId || 'validate-webhook-unknown';
      const endpointUrl = req.body.endpointUrl || req.query.endpointUrl as string;

      if (!endpointUrl) {
        sendErrorResponse(res, 'Endpoint URL is required', 400);
        return;
      }

      logger.info('Validating webhook endpoint', {
        endpointUrl,
        requestId
      });

      const validationResult = await this.webhookService.validateWebhookEndpoint(endpointUrl);

      sendSuccessResponse(res, 'Webhook endpoint validated successfully', validationResult);

    } catch (error) {
      logger.error('Failed to validate webhook endpoint', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: req.requestId || 'unknown'
      });

      sendErrorResponse(res, 'Failed to validate webhook endpoint', 500);
    }
  }

  async getWebhookConfiguration(req: WebhookRequest, res: Response): Promise<void> {
    try {
      const requestId = req.requestId || 'webhook-config-unknown';

      logger.info('Retrieving webhook configuration', {
        requestId
      });

      const configuration = await this.webhookService.getWebhookConfiguration();

      sendSuccessResponse(res, 'Webhook configuration retrieved successfully', configuration);

    } catch (error) {
      logger.error('Failed to get webhook configuration', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: req.requestId || 'unknown'
      });

      sendErrorResponse(res, 'Failed to get webhook configuration', 500);
    }
  }
}
