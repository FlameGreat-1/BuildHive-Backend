import { Request, Response } from 'express';
import { logger, sendSuccessResponse, sendErrorResponse } from '../../shared/utils';
import { WebhookService } from '../services';
import { StripeWebhookEvent, WebhookProcessingResult } from '../types';

interface WebhookRequest extends Request {
  requestId?: string;
  webhookEvent?: StripeWebhookEvent;
}

export class WebhookController {
  private webhookService: WebhookService;

  constructor() {
    this.webhookService = new WebhookService();
  }

  async handleStripeWebhook(req: WebhookRequest, res: Response): Promise<void> {
    try {
      const requestId = req.requestId || 'webhook-unknown';
      const webhookEvent = req.webhookEvent;

      if (!webhookEvent) {
        logger.warn('Webhook event not found in request', {
          requestId,
          ip: req.ip
        });
        return sendErrorResponse(res, 'Webhook event not found', 400);
      }

      logger.info('Processing webhook event', {
        eventId: webhookEvent.id,
        eventType: webhookEvent.type,
        requestId,
        ip: req.ip
      });

      const result: WebhookProcessingResult = await this.webhookService.processWebhookEvent(
        webhookEvent,
        requestId
      );

      if (result.success) {
        logger.info('Webhook processed successfully', {
          eventId: result.eventId,
          eventType: result.eventType,
          processedAt: result.processedAt,
          requestId
        });

        sendSuccessResponse(res, result.message || 'Webhook processed successfully', {
          eventId: result.eventId,
          eventType: result.eventType,
          processed: true,
          processedAt: result.processedAt
        });
      } else {
        logger.warn('Webhook processing failed', {
          eventId: result.eventId,
          eventType: result.eventType,
          error: result.error || 'Unknown processing error',
          retryAfter: result.retryAfter,
          requestId
        });

        const statusCode = result.retryAfter ? 429 : 400;
        const response: any = {
          eventId: result.eventId,
          processed: false,
          error: result.error || 'Processing failed'
        };

        if (result.retryAfter) {
          response.retryAfter = result.retryAfter;
          res.set('Retry-After', result.retryAfter.toString());
        }

        sendErrorResponse(res, result.error || 'Webhook processing failed', statusCode, response);
      }

    } catch (error) {
      logger.error('Webhook processing error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        eventId: req.webhookEvent?.id,
        eventType: req.webhookEvent?.type,
        requestId: req.requestId || 'unknown',
        ip: req.ip
      });

      sendErrorResponse(res, 'Internal webhook processing error', 500, {
        eventId: req.webhookEvent?.id,
        processed: false
      });
    }
  }

  async retryWebhookEvent(req: WebhookRequest, res: Response): Promise<void> {
    try {
      const requestId = req.requestId || 'retry-unknown';
      const eventId = req.params.eventId;

      if (!eventId) {
        logger.warn('Webhook retry attempted without event ID', {
          requestId,
          ip: req.ip
        });
        return sendErrorResponse(res, 'Event ID is required', 400);
      }

      logger.info('Retrying webhook event', {
        eventId,
        requestId,
        ip: req.ip
      });

      const retryResult = await this.webhookService.retryWebhookEvent(eventId, requestId);

      if (retryResult.success) {
        logger.info('Webhook retry completed successfully', {
          eventId,
          message: retryResult.message || 'Retry successful',
          requestId
        });

        sendSuccessResponse(res, retryResult.message || 'Webhook retry completed successfully', {
          eventId,
          retried: true,
          success: true,
          processedAt: retryResult.processedAt
        });
      } else {
        logger.warn('Webhook retry failed', {
          eventId,
          error: retryResult.error || 'Retry failed',
          requestId
        });

        sendErrorResponse(res, retryResult.error || 'Webhook retry failed', 400, {
          eventId,
          retried: false,
          error: retryResult.error
        });
      }

    } catch (error) {
      logger.error('Webhook retry error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        eventId: req.params.eventId,
        requestId: req.requestId || 'unknown',
        ip: req.ip
      });

      sendErrorResponse(res, 'Failed to retry webhook event', 500, {
        eventId: req.params.eventId,
        retried: false
      });
    }
  }

  async getWebhookEventStatus(req: WebhookRequest, res: Response): Promise<void> {
    try {
      const requestId = req.requestId || 'status-unknown';
      const eventId = req.params.eventId;

      if (!eventId) {
        return sendErrorResponse(res, 'Event ID is required', 400);
      }

      logger.info('Retrieving webhook event status', {
        eventId,
        requestId
      });

      const status = await this.webhookService.getWebhookEventStatus(eventId, requestId);

      if (!status) {
        logger.warn('Webhook event not found', {
          eventId,
          requestId
        });
        return sendErrorResponse(res, 'Webhook event not found', 404);
      }

      logger.info('Webhook event status retrieved', {
        eventId,
        processed: status.processed,
        requestId
      });

      sendSuccessResponse(res, 'Webhook event status retrieved successfully', status);

    } catch (error) {
      logger.error('Failed to get webhook event status', {
        error: error instanceof Error ? error.message : 'Unknown error',
        eventId: req.params.eventId,
        requestId: req.requestId || 'unknown'
      });

      sendErrorResponse(res, 'Failed to get webhook event status', 500);
    }
  }

  async listWebhookEvents(req: WebhookRequest, res: Response): Promise<void> {
    try {
      const requestId = req.requestId || 'list-unknown';
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

      const events = await this.webhookService.listWebhookEvents({
        limit,
        offset,
        eventType,
        processed
      }, requestId);

      sendSuccessResponse(res, 'Webhook events retrieved successfully', events);

    } catch (error) {
      logger.error('Failed to list webhook events', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: req.requestId || 'unknown'
      });

      sendErrorResponse(res, 'Failed to list webhook events', 500);
    }
  }

  async getWebhookStats(req: WebhookRequest, res: Response): Promise<void> {
    try {
      const requestId = req.requestId || 'stats-unknown';
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

      logger.info('Retrieving webhook statistics', {
        startDate,
        endDate,
        requestId
      });

      const stats = await this.webhookService.getWebhookStats({
        startDate,
        endDate
      }, requestId);

      sendSuccessResponse(res, 'Webhook statistics retrieved successfully', stats);

    } catch (error) {
      logger.error('Failed to get webhook statistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: req.requestId || 'unknown'
      });

      sendErrorResponse(res, 'Failed to get webhook statistics', 500);
    }
  }

  async deleteWebhookEvent(req: WebhookRequest, res: Response): Promise<void> {
    try {
      const requestId = req.requestId || 'delete-unknown';
      const eventId = req.params.eventId;

      if (!eventId) {
        return sendErrorResponse(res, 'Event ID is required', 400);
      }

      logger.info('Deleting webhook event', {
        eventId,
        requestId
      });

      const deleted = await this.webhookService.deleteWebhookEvent(eventId, requestId);

      if (deleted) {
        logger.info('Webhook event deleted successfully', {
          eventId,
          requestId
        });

        sendSuccessResponse(res, 'Webhook event deleted successfully', {
          eventId,
          deleted: true
        });
      } else {
        logger.warn('Webhook event not found for deletion', {
          eventId,
          requestId
        });

        sendErrorResponse(res, 'Webhook event not found', 404);
      }

    } catch (error) {
      logger.error('Failed to delete webhook event', {
        error: error instanceof Error ? error.message : 'Unknown error',
        eventId: req.params.eventId,
        requestId: req.requestId || 'unknown'
      });

      sendErrorResponse(res, 'Failed to delete webhook event', 500);
    }
  }
}

export const webhookController = new WebhookController();
