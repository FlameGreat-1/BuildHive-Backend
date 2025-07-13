import { DatabaseClient, DatabaseTransaction, WebhookEventDatabaseRecord, WebhookEventType } from '../../shared/types';
import { WebhookEventModel } from '../models';
import { logger } from '../../shared/utils';
import { WebhookEventFilter, WebhookEventSummary } from '../types';

export class WebhookRepository {
  private webhookEventModel: WebhookEventModel;

  constructor(client: DatabaseClient) {
    this.webhookEventModel = new WebhookEventModel(client);
  }

  async create(
    webhookData: Omit<WebhookEventDatabaseRecord, 'id' | 'created_at' | 'processed_at'>,
    transaction?: DatabaseTransaction
  ): Promise<WebhookEventDatabaseRecord> {
    try {
      const webhookEvent = await this.webhookEventModel.create(webhookData, transaction);
      
      logger.info('Webhook event created successfully', {
        webhookEventId: webhookEvent.id,
        stripeEventId: webhookEvent.stripe_event_id,
        eventType: webhookEvent.event_type
      });

      return webhookEvent;
    } catch (error) {
      logger.error('Failed to create webhook event', {
        stripeEventId: webhookData.stripe_event_id,
        eventType: webhookData.event_type,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async findById(id: number): Promise<WebhookEventDatabaseRecord | null> {
    try {
      const webhookEvent = await this.webhookEventModel.findById(id);
      
      if (webhookEvent) {
        logger.info('Webhook event retrieved successfully', {
          webhookEventId: id,
          stripeEventId: webhookEvent.stripe_event_id,
          eventType: webhookEvent.event_type
        });
      }

      return webhookEvent;
    } catch (error) {
      logger.error('Failed to retrieve webhook event', {
        webhookEventId: id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async findByStripeEventId(stripeEventId: string): Promise<WebhookEventDatabaseRecord | null> {
    try {
      const webhookEvent = await this.webhookEventModel.findByStripeEventId(stripeEventId);
      
      if (webhookEvent) {
        logger.info('Webhook event retrieved by Stripe ID', {
          webhookEventId: webhookEvent.id,
          stripeEventId,
          eventType: webhookEvent.event_type
        });
      }

      return webhookEvent;
    } catch (error) {
      logger.error('Failed to retrieve webhook event by Stripe ID', {
        stripeEventId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
  
  async getWebhookEventByStripeId(stripeEventId: string): Promise<WebhookEventDatabaseRecord | null> {
  return this.findByStripeEventId(stripeEventId);
}

  async markAsProcessed(
    id: number,
    transaction?: DatabaseTransaction
  ): Promise<WebhookEventDatabaseRecord> {
    try {
      const webhookEvent = await this.webhookEventModel.markAsProcessed(id, transaction);
      
      logger.info('Webhook event marked as processed', {
        webhookEventId: id,
        stripeEventId: webhookEvent.stripe_event_id,
        eventType: webhookEvent.event_type
      });

      return webhookEvent;
    } catch (error) {
      logger.error('Failed to mark webhook event as processed', {
        webhookEventId: id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async findUnprocessed(limit: number = 100): Promise<WebhookEventDatabaseRecord[]> {
    try {
      const webhookEvents = await this.webhookEventModel.findUnprocessed(limit);
      
      logger.info('Unprocessed webhook events retrieved', {
        count: webhookEvents.length,
        limit
      });

      return webhookEvents;
    } catch (error) {
      logger.error('Failed to retrieve unprocessed webhook events', {
        limit,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async findByEventType(
    eventType: WebhookEventType,
    processed?: boolean,
    limit: number = 100
  ): Promise<WebhookEventDatabaseRecord[]> {
    try {
      const webhookEvents = await this.webhookEventModel.findByEventType(eventType, processed, limit);
      
      logger.info('Webhook events retrieved by type', {
        eventType,
        processed,
        count: webhookEvents.length,
        limit
      });

      return webhookEvents;
    } catch (error) {
      logger.error('Failed to retrieve webhook events by type', {
        eventType,
        processed,
        limit,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async findByDateRange(
    startDate: Date,
    endDate: Date,
    eventType?: WebhookEventType
  ): Promise<WebhookEventDatabaseRecord[]> {
    try {
      const webhookEvents = await this.webhookEventModel.findByDateRange(startDate, endDate, eventType);
      
      logger.info('Webhook events retrieved by date range', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        eventType,
        count: webhookEvents.length
      });

      return webhookEvents;
    } catch (error) {
      logger.error('Failed to retrieve webhook events by date range', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        eventType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async getProcessingStats(): Promise<{
    total_events: number;
    processed_events: number;
    pending_events: number;
    events_by_type: Record<string, number>;
  }> {
    try {
      const stats = await this.webhookEventModel.getProcessingStats();
      
      logger.info('Webhook processing stats retrieved', {
        stats
      });

      return stats;
    } catch (error) {
      logger.error('Failed to retrieve webhook processing stats', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async update(
    id: number,
    updateData: Partial<Pick<WebhookEventDatabaseRecord, 'processed' | 'retry_count' | 'failure_reason' | 'processed_at'>>,
    transaction?: DatabaseTransaction
  ): Promise<WebhookEventDatabaseRecord> {
    try {
      const webhookEvent = await this.webhookEventModel.update(id, updateData, transaction);
      
      logger.info('Webhook event updated successfully', {
        webhookEventId: id,
        updatedFields: Object.keys(updateData)
      });

      return webhookEvent;
    } catch (error) {
      logger.error('Failed to update webhook event', {
        webhookEventId: id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async delete(
    id: number,
    transaction?: DatabaseTransaction
  ): Promise<boolean> {
    try {
      const deleted = await this.webhookEventModel.delete(id, transaction);
      
      if (deleted) {
        logger.info('Webhook event deleted successfully', {
          webhookEventId: id
        });
      }

      return deleted;
    } catch (error) {
      logger.error('Failed to delete webhook event', {
        webhookEventId: id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async deleteOldEvents(olderThanDays: number): Promise<number> {
    try {
      const deletedCount = await this.webhookEventModel.deleteOldEvents(olderThanDays);
      
      logger.info('Old webhook events cleaned up', {
        deletedCount,
        olderThanDays
      });

      return deletedCount;
    } catch (error) {
      logger.error('Failed to cleanup old webhook events', {
        olderThanDays,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
}
