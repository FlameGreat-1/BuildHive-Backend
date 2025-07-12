import { DatabaseClient, DatabaseTransaction, WebhookEventDatabaseRecord, WebhookEventType } from '../../shared/types';
import { PAYMENT_TABLES } from '../../config/payment';
import { logger } from '../../shared/utils';

export class WebhookEventModel {
  private client: DatabaseClient;

  constructor(client: DatabaseClient) {
    this.client = client;
  }

  async create(
    webhookData: Omit<WebhookEventDatabaseRecord, 'id' | 'created_at' | 'processed_at'>,
    transaction?: DatabaseTransaction
  ): Promise<WebhookEventDatabaseRecord> {
    const query = `
      INSERT INTO ${PAYMENT_TABLES.WEBHOOK_EVENTS} (
        stripe_event_id, event_type, processed, data, retry_count, failure_reason, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [
      webhookData.stripe_event_id,
      webhookData.event_type,
      webhookData.processed,
      JSON.stringify(webhookData.data),
      webhookData.retry_count || 0,
      webhookData.failure_reason || null,
      JSON.stringify(webhookData.metadata || {})
    ];

    const executor = transaction || this.client;
    const result = await executor.query<WebhookEventDatabaseRecord>(query, values);
    
    if (result.rows.length === 0) {
      logger.error('Failed to create webhook event record', {
        stripeEventId: webhookData.stripe_event_id,
        eventType: webhookData.event_type
      });
      throw new Error('Failed to create webhook event record');
    }

    logger.info('Webhook event created', {
      id: result.rows[0].id,
      stripeEventId: webhookData.stripe_event_id,
      eventType: webhookData.event_type
    });

    return result.rows[0];
  }

  async update(
    id: number,
    updateData: Partial<Pick<WebhookEventDatabaseRecord, 'processed' | 'retry_count' | 'failure_reason' | 'processed_at' | 'metadata'>>,
    transaction?: DatabaseTransaction
  ): Promise<WebhookEventDatabaseRecord> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updateData.processed !== undefined) {
      fields.push(`processed = $${paramIndex++}`);
      values.push(updateData.processed);
    }

    if (updateData.retry_count !== undefined) {
      fields.push(`retry_count = $${paramIndex++}`);
      values.push(updateData.retry_count);
    }

    if (updateData.failure_reason !== undefined) {
      fields.push(`failure_reason = $${paramIndex++}`);
      values.push(updateData.failure_reason);
    }

    if (updateData.processed_at !== undefined) {
      fields.push(`processed_at = $${paramIndex++}`);
      values.push(updateData.processed_at);
    }

    if (updateData.metadata !== undefined) {
      fields.push(`metadata = $${paramIndex++}`);
      values.push(JSON.stringify(updateData.metadata));
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(id);

    const query = `
      UPDATE ${PAYMENT_TABLES.WEBHOOK_EVENTS} 
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const executor = transaction || this.client;
    const result = await executor.query<WebhookEventDatabaseRecord>(query, values);
    
    if (result.rows.length === 0) {
      logger.error('Webhook event not found for update', { id });
      throw new Error('Webhook event not found or update failed');
    }

    logger.info('Webhook event updated', {
      id: result.rows[0].id,
      stripeEventId: result.rows[0].stripe_event_id,
      updatedFields: Object.keys(updateData)
    });

    return result.rows[0];
  }

  async delete(id: number, transaction?: DatabaseTransaction): Promise<boolean> {
    const query = `DELETE FROM ${PAYMENT_TABLES.WEBHOOK_EVENTS} WHERE id = $1`;
    const executor = transaction || this.client;
    const result = await executor.query(query, [id]);
    
    const deleted = result.rowCount > 0;
    
    if (deleted) {
      logger.info('Webhook event deleted', { id });
    }
    
    return deleted;
  }

  async findById(id: number): Promise<WebhookEventDatabaseRecord | null> {
    const query = `SELECT * FROM ${PAYMENT_TABLES.WEBHOOK_EVENTS} WHERE id = $1`;
    const result = await this.client.query<WebhookEventDatabaseRecord>(query, [id]);
    
    return result.rows[0] || null;
  }

  async findByStripeEventId(stripeEventId: string): Promise<WebhookEventDatabaseRecord | null> {
    const query = `SELECT * FROM ${PAYMENT_TABLES.WEBHOOK_EVENTS} WHERE stripe_event_id = $1`;
    const result = await this.client.query<WebhookEventDatabaseRecord>(query, [stripeEventId]);
    
    return result.rows[0] || null;
  }

  async markAsProcessed(
    id: number,
    transaction?: DatabaseTransaction
  ): Promise<WebhookEventDatabaseRecord> {
    const query = `
      UPDATE ${PAYMENT_TABLES.WEBHOOK_EVENTS} 
      SET processed = true, processed_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    const executor = transaction || this.client;
    const result = await executor.query<WebhookEventDatabaseRecord>(query, [id]);
    
    if (result.rows.length === 0) {
      logger.error('Webhook event not found for processing', { id });
      throw new Error('Webhook event not found or update failed');
    }

    logger.info('Webhook event marked as processed', {
      id: result.rows[0].id,
      stripeEventId: result.rows[0].stripe_event_id
    });

    return result.rows[0];
  }

  async findUnprocessed(limit: number = 100): Promise<WebhookEventDatabaseRecord[]> {
    const query = `
      SELECT * FROM ${PAYMENT_TABLES.WEBHOOK_EVENTS} 
      WHERE processed = false 
      ORDER BY created_at ASC 
      LIMIT $1
    `;
    
    const result = await this.client.query<WebhookEventDatabaseRecord>(query, [limit]);
    return result.rows;
  }

  async findByEventType(
    eventType: WebhookEventType,
    processed?: boolean,
    limit: number = 50
  ): Promise<WebhookEventDatabaseRecord[]> {
    let query = `
      SELECT * FROM ${PAYMENT_TABLES.WEBHOOK_EVENTS} 
      WHERE event_type = $1
    `;
    
    const values: any[] = [eventType];
    
    if (processed !== undefined) {
      query += ` AND processed = $2`;
      values.push(processed);
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${values.length + 1}`;
    values.push(limit);
    
    const result = await this.client.query<WebhookEventDatabaseRecord>(query, values);
    return result.rows;
  }

  async findByDateRange(
    startDate: Date,
    endDate: Date,
    eventType?: WebhookEventType
  ): Promise<WebhookEventDatabaseRecord[]> {
    let query = `
      SELECT * FROM ${PAYMENT_TABLES.WEBHOOK_EVENTS} 
      WHERE created_at >= $1 AND created_at <= $2
    `;
    
    const values: any[] = [startDate, endDate];
    
    if (eventType) {
      query += ` AND event_type = $3`;
      values.push(eventType);
    }
    
    query += ` ORDER BY created_at DESC`;
    
    const result = await this.client.query<WebhookEventDatabaseRecord>(query, values);
    return result.rows;
  }

  async getProcessingStats(): Promise<{
    total_events: number;
    processed_events: number;
    pending_events: number;
    events_by_type: Record<string, number>;
  }> {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_events,
        COUNT(CASE WHEN processed = true THEN 1 END) as processed_events,
        COUNT(CASE WHEN processed = false THEN 1 END) as pending_events
      FROM ${PAYMENT_TABLES.WEBHOOK_EVENTS}
    `;
    
    const typeQuery = `
      SELECT event_type, COUNT(*) as count
      FROM ${PAYMENT_TABLES.WEBHOOK_EVENTS}
      GROUP BY event_type
    `;
    
    const [statsResult, typeResult] = await Promise.all([
      this.client.query(statsQuery),
      this.client.query<{ event_type: string; count: string }>(typeQuery)
    ]);
    
    const stats = statsResult.rows[0];
    const eventsByType: Record<string, number> = {};
    
    typeResult.rows.forEach(row => {
      eventsByType[row.event_type] = parseInt(row.count, 10);
    });
    
    return {
      total_events: parseInt(stats.total_events, 10),
      processed_events: parseInt(stats.processed_events, 10),
      pending_events: parseInt(stats.pending_events, 10),
      events_by_type: eventsByType
    };
  }

  async deleteOldEvents(olderThanDays: number = 90): Promise<number> {
    const query = `
      DELETE FROM ${PAYMENT_TABLES.WEBHOOK_EVENTS} 
      WHERE processed = true 
      AND created_at < NOW() - INTERVAL '${olderThanDays} days'
    `;
    
    const result = await this.client.query(query);
    const deletedCount = result.rowCount;
    
    logger.info('Old webhook events cleaned up', {
      deletedCount,
      olderThanDays
    });
    
    return deletedCount;
  }
}
