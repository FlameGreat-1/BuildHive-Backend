import { DatabaseClient, DatabaseTransaction, WebhookEventDatabaseRecord, WebhookEventType } from '../../shared/types';
import { WebhookEventModel } from '../models';
import { logger } from '../../shared/utils';
import { WebhookEventFilter, WebhookEventSummary } from '../types';

export class WebhookRepository {
  private webhookEventModel: WebhookEventModel;

  constructor(client: DatabaseClient) {
    this.webhookEventModel = new WebhookEventModel(client);
  }

  async createWebhookEvent(
    webhookData: Omit<WebhookEventDatabaseRecord, 'id' | 'created_at' | 'processed_at'>,
    requestId: string,
    transaction?: DatabaseTransaction
  ): Promise<WebhookEventDatabaseRecord> {
    try {
      const webhookEvent = await this.webhookEventModel.create(webhookData, transaction);
      
      logger.info('Webhook event created successfully', {
        webhookEventId: webhookEvent.id,
        stripeEventId: webhookEvent.stripe_event_id,
        eventType: webhookEvent.event_type,
        requestId
      });

      return webhookEvent;
    } catch (error) {
      logger.error('Failed to create webhook event', {
        stripeEventId: webhookData.stripe_event_id,
        eventType: webhookData.event_type,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  async getWebhookEventById(
    id: number,
    requestId: string
  ): Promise<WebhookEventDatabaseRecord | null> {
    try {
      const webhookEvent = await this.webhookEventModel.findById(id);
      
      if (webhookEvent) {
        logger.info('Webhook event retrieved successfully', {
          webhookEventId: id,
          stripeEventId: webhookEvent.stripe_event_id,
          eventType: webhookEvent.event_type,
          requestId
        });
      }

      return webhookEvent;
    } catch (error) {
      logger.error('Failed to retrieve webhook event', {
        webhookEventId: id,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  async getWebhookEventByStripeId(
    stripeEventId: string,
    requestId: string
  ): Promise<WebhookEventDatabaseRecord | null> {
    try {
      const webhookEvent = await this.webhookEventModel.findByStripeEventId(stripeEventId);
      
      if (webhookEvent) {
        logger.info('Webhook event retrieved by Stripe ID', {
          webhookEventId: webhookEvent.id,
          stripeEventId,
          eventType: webhookEvent.event_type,
          requestId
        });
      }

      return webhookEvent;
    } catch (error) {
      logger.error('Failed to retrieve webhook event by Stripe ID', {
        stripeEventId,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  async markWebhookEventAsProcessed(
    id: number,
    requestId: string,
    transaction?: DatabaseTransaction
  ): Promise<WebhookEventDatabaseRecord> {
    try {
      const webhookEvent = await this.webhookEventModel.markAsProcessed(id, transaction);
      
      logger.info('Webhook event marked as processed', {
        webhookEventId: id,
        stripeEventId: webhookEvent.stripe_event_id,
        eventType: webhookEvent.event_type,
        requestId
      });

      return webhookEvent;
    } catch (error) {
      logger.error('Failed to mark webhook event as processed', {
        webhookEventId: id,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  async getUnprocessedWebhookEvents(
    limit: number,
    requestId: string
  ): Promise<WebhookEventDatabaseRecord[]> {
    try {
      const webhookEvents = await this.webhookEventModel.findUnprocessed(limit);
      
      logger.info('Unprocessed webhook events retrieved', {
        count: webhookEvents.length,
        limit,
        requestId
      });

      return webhookEvents;
    } catch (error) {
      logger.error('Failed to retrieve unprocessed webhook events', {
        limit,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  async getWebhookEventsByType(
    eventType: WebhookEventType,
    processed: boolean | undefined,
    limit: number,
    requestId: string
  ): Promise<WebhookEventDatabaseRecord[]> {
    try {
      const webhookEvents = await this.webhookEventModel.findByEventType(eventType, processed, limit);
      
      logger.info('Webhook events retrieved by type', {
        eventType,
        processed,
        count: webhookEvents.length,
        limit,
        requestId
      });

      return webhookEvents;
    } catch (error) {
      logger.error('Failed to retrieve webhook events by type', {
        eventType,
        processed,
        limit,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  async getWebhookEventsByDateRange(
    startDate: Date,
    endDate: Date,
    eventType: WebhookEventType | undefined,
    requestId: string
  ): Promise<WebhookEventDatabaseRecord[]> {
    try {
      const webhookEvents = await this.webhookEventModel.findByDateRange(startDate, endDate, eventType);
      
      logger.info('Webhook events retrieved by date range', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        eventType,
        count: webhookEvents.length,
        requestId
      });

      return webhookEvents;
    } catch (error) {
      logger.error('Failed to retrieve webhook events by date range', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        eventType,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  async getWebhookProcessingStats(requestId: string): Promise<WebhookEventSummary> {
    try {
      const stats = await this.webhookEventModel.getProcessingStats();
      
      const summary: WebhookEventSummary = {
        totalEvents: stats.total_events,
        processedEvents: stats.processed_events,
        failedEvents: 0,
        pendingEvents: stats.pending_events,
        eventsByType: stats.events_by_type as Record<WebhookEventType, number>
      };

      logger.info('Webhook processing stats retrieved', {
        summary,
        requestId
      });

      return summary;
    } catch (error) {
      logger.error('Failed to retrieve webhook processing stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  async cleanupOldWebhookEvents(
    olderThanDays: number,
    requestId: string
  ): Promise<number> {
    try {
      const deletedCount = await this.webhookEventModel.deleteOldEvents(olderThanDays);
      
      logger.info('Old webhook events cleaned up', {
        deletedCount,
        olderThanDays,
        requestId
      });

      return deletedCount;
    } catch (error) {
      logger.error('Failed to cleanup old webhook events', {
        olderThanDays,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }
}
