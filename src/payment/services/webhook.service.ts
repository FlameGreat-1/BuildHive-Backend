import { WEBHOOK_CONFIG } from '../../config/payment';
import { logger } from '../../shared/utils';
import { WebhookRepository, PaymentRepository, RefundRepository, InvoiceRepository } from '../repositories';
import { getDbConnection } from '../../shared/database';
import { 
  WebhookEventType,
  WebhookProcessingResult,
  StripeWebhookEvent
} from '../types';
import { 
  parseWebhookEvent,
  validateWebhookSignature,
  isWebhookEventDuplicate
} from '../utils';
import { 
  WebhookEventDatabaseRecord, 
  PaymentStatus, 
  RefundStatus,
  InvoiceStatus
} from '../../shared/types';

export class WebhookService {
  private webhookRepository: WebhookRepository;
  private paymentRepository: PaymentRepository;
  private refundRepository: RefundRepository;
  private invoiceRepository: InvoiceRepository;

  constructor() {
    this.initializeRepositories();
  }

  private async initializeRepositories(): Promise<void> {
    const dbConnection = getDbConnection();
    this.webhookRepository = new WebhookRepository(dbConnection);
    this.paymentRepository = new PaymentRepository(dbConnection);
    this.refundRepository = new RefundRepository(dbConnection);
    this.invoiceRepository = new InvoiceRepository(dbConnection);
  }

  async processWebhookEvent(
    payload: string,
    signature: string,
    requestId: string
  ): Promise<WebhookProcessingResult> {
    try {
      if (!validateWebhookSignature(payload, signature, process.env.STRIPE_WEBHOOK_SECRET || '')) {
        throw new Error('Invalid webhook signature');
      }

      const parseResult = parseWebhookEvent(payload, signature);
      if (!parseResult.isValid || !parseResult.event) {
        throw new Error('Invalid webhook event format');
      }

      const event = parseResult.event;

      // Check for duplicate events
      const existingEvent = await this.webhookRepository.findByStripeEventId(event.id);

      if (existingEvent) {
        logger.info('Duplicate webhook event ignored', {
          eventId: event.id,
          eventType: event.type,
          existingEventId: existingEvent.id,
          requestId
        });

        return {
          success: true,
          processed: true,
          eventId: event.id,
          message: 'Event already processed'
        };
      }

      // Create webhook event record
      const webhookEventData: Omit<WebhookEventDatabaseRecord, 'id' | 'created_at' | 'processed_at'> = {
        stripe_event_id: event.id,
        event_type: event.type,
        processed: false,
        data: event.data,
        retry_count: 0,
        failure_reason: null,
        metadata: {
          apiVersion: event.api_version,
          created: event.created,
          livemode: event.livemode,
          requestId
        }
      };

      const savedEvent = await this.webhookRepository.create(webhookEventData);

      // Process the webhook event
      const processingResult = await this.handleWebhookEvent(event, requestId);

      // Update webhook event with processing result
      await this.webhookRepository.update(
        savedEvent.id,
        {
          processed: processingResult.success,
          processed_at: processingResult.success ? new Date() : null,
          failure_reason: processingResult.success ? null : processingResult.message
        }
      );

      logger.info('Webhook event processed', {
        eventId: event.id,
        eventType: event.type,
        success: processingResult.success,
        message: processingResult.message,
        requestId
      });

      return {
        success: processingResult.success,
        processed: true,
        eventId: event.id,
        message: processingResult.message
      };
    } catch (error) {
      logger.error('Failed to process webhook event', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      return {
        success: false,
        processed: false,
        eventId: null,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async handleWebhookEvent(
    event: StripeWebhookEvent,
    requestId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          return await this.handlePaymentIntentSucceeded(event, requestId);

        case 'payment_intent.payment_failed':
          return await this.handlePaymentIntentFailed(event, requestId);

        case 'payment_intent.canceled':
          return await this.handlePaymentIntentCanceled(event, requestId);

        case 'payment_method.attached':
          return await this.handlePaymentMethodAttached(event, requestId);

        case 'charge.dispute.created':
          return await this.handleChargeDisputeCreated(event, requestId);

        case 'invoice.payment_succeeded':
          return await this.handleInvoicePaymentSucceeded(event, requestId);

        case 'invoice.payment_failed':
          return await this.handleInvoicePaymentFailed(event, requestId);

        case 'refund.created':
          return await this.handleRefundCreated(event, requestId);

        case 'refund.updated':
          return await this.handleRefundUpdated(event, requestId);

        default:
          logger.warn('Unhandled webhook event type', {
            eventType: event.type,
            eventId: event.id,
            requestId
          });

          return {
            success: true,
            message: `Unhandled event type: ${event.type}`
          };
      }
    } catch (error) {
      logger.error('Failed to handle webhook event', {
        eventType: event.type,
        eventId: event.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async handlePaymentIntentSucceeded(
    event: StripeWebhookEvent,
    requestId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const paymentIntent = event.data.object;
      const payment = await this.paymentRepository.findByStripePaymentIntentId(paymentIntent.id);

      if (!payment) {
        return {
          success: false,
          message: 'Payment not found for payment intent'
        };
      }

      await this.paymentRepository.updateStatus(
        payment.id,
        PaymentStatus.SUCCEEDED,
        new Date()
      );

      logger.info('Payment intent succeeded processed', {
        paymentIntentId: paymentIntent.id,
        paymentId: payment.id,
        amount: paymentIntent.amount,
        requestId
      });

      return {
        success: true,
        message: 'Payment intent succeeded processed successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async handlePaymentIntentFailed(
    event: StripeWebhookEvent,
    requestId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const paymentIntent = event.data.object;
      const payment = await this.paymentRepository.findByStripePaymentIntentId(paymentIntent.id);

      if (!payment) {
        return {
          success: false,
          message: 'Payment not found for payment intent'
        };
      }

      const failureReason = paymentIntent.last_payment_error?.message || 'Payment failed';

      await this.paymentRepository.update(payment.id, {
        status: PaymentStatus.FAILED,
        failure_reason: failureReason
      });

      logger.info('Payment intent failed processed', {
        paymentIntentId: paymentIntent.id,
        paymentId: payment.id,
        failureReason,
        requestId
      });

      return {
        success: true,
        message: 'Payment intent failed processed successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async handlePaymentIntentCanceled(
    event: StripeWebhookEvent,
    requestId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const paymentIntent = event.data.object;
      const payment = await this.paymentRepository.findByStripePaymentIntentId(paymentIntent.id);

      if (!payment) {
        return {
          success: false,
          message: 'Payment not found for payment intent'
        };
      }

      await this.paymentRepository.updateStatus(
        payment.id,
        PaymentStatus.CANCELLED
      );

      logger.info('Payment intent canceled processed', {
        paymentIntentId: paymentIntent.id,
        paymentId: payment.id,
        requestId
      });

      return {
        success: true,
        message: 'Payment intent canceled processed successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async handlePaymentMethodAttached(
    event: StripeWebhookEvent,
    requestId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const paymentMethod = event.data.object;
      
      logger.info('Payment method attached processed', {
        paymentMethodId: paymentMethod.id,
        customerId: paymentMethod.customer,
        type: paymentMethod.type,
        requestId
      });

      return {
        success: true,
        message: 'Payment method attached processed successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async handleChargeDisputeCreated(
    event: StripeWebhookEvent,
    requestId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const dispute = event.data.object;
      
      logger.warn('Charge dispute created', {
        disputeId: dispute.id,
        chargeId: dispute.charge,
        amount: dispute.amount,
        reason: dispute.reason,
        status: dispute.status,
        requestId
      });

      // TODO: In the future we need to  Implement dispute handling logic
      // This could include updating payment status, notifying administrators, etc.

      return {
        success: true,
        message: 'Charge dispute created processed successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
    private async handleInvoicePaymentSucceeded(
    event: StripeWebhookEvent,
    requestId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const invoice = event.data.object;
      
      // Find invoice by Stripe invoice ID
      const localInvoice = await this.invoiceRepository.findByStripeInvoiceId(invoice.id);
      
      if (localInvoice) {
        await this.invoiceRepository.updateStatus(
          localInvoice.id,
          InvoiceStatus.PAID,
          new Date()
        );
      }

      logger.info('Invoice payment succeeded processed', {
        stripeInvoiceId: invoice.id,
        localInvoiceId: localInvoice?.id,
        amount: invoice.amount_paid,
        requestId
      });

      return {
        success: true,
        message: 'Invoice payment succeeded processed successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async handleInvoicePaymentFailed(
    event: StripeWebhookEvent,
    requestId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const invoice = event.data.object;
      
      // Find invoice by Stripe invoice ID
      const localInvoice = await this.invoiceRepository.findByStripeInvoiceId(invoice.id);
      
      if (localInvoice) {
        await this.invoiceRepository.updateStatus(
          localInvoice.id,
          InvoiceStatus.FAILED
        );
      }

      logger.warn('Invoice payment failed processed', {
        stripeInvoiceId: invoice.id,
        localInvoiceId: localInvoice?.id,
        amount: invoice.amount_due,
        requestId
      });

      return {
        success: true,
        message: 'Invoice payment failed processed successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async handleRefundCreated(
    event: StripeWebhookEvent,
    requestId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const refund = event.data.object;
      
      // Find refund by Stripe refund ID
      const localRefund = await this.refundRepository.findByStripeRefundId(refund.id);
      
      if (localRefund) {
        await this.refundRepository.updateStatus(
          localRefund.id,
          RefundStatus.PENDING
        );
      }

      logger.info('Refund created processed', {
        stripeRefundId: refund.id,
        localRefundId: localRefund?.id,
        amount: refund.amount,
        status: refund.status,
        requestId
      });

      return {
        success: true,
        message: 'Refund created processed successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async handleRefundUpdated(
    event: StripeWebhookEvent,
    requestId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const refund = event.data.object;
      
      // Find refund by Stripe refund ID
      const localRefund = await this.refundRepository.findByStripeRefundId(refund.id);
      
      if (localRefund) {
        let status: RefundStatus;
        let processedAt: Date | undefined;

        switch (refund.status) {
          case 'succeeded':
            status = RefundStatus.PROCESSED;
            processedAt = new Date();
            break;
          case 'failed':
            status = RefundStatus.FAILED;
            break;
          case 'canceled':
            status = RefundStatus.REJECTED;
            break;
          default:
            status = RefundStatus.PENDING;
        }

        await this.refundRepository.updateStatus(
          localRefund.id,
          status,
          processedAt
        );
      }

      logger.info('Refund updated processed', {
        stripeRefundId: refund.id,
        localRefundId: localRefund?.id,
        amount: refund.amount,
        status: refund.status,
        requestId
      });

      return {
        success: true,
        message: 'Refund updated processed successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  async retryFailedWebhookEvent(eventId: number, requestId: string): Promise<WebhookProcessingResult> {
    try {
      const webhookEvent = await this.webhookRepository.findById(eventId);

      if (!webhookEvent) {
        throw new Error('Webhook event not found');
      }

      if (webhookEvent.processed) {
        return {
          success: true,
          processed: true,
          eventId: webhookEvent.stripe_event_id,
          message: 'Event already processed'
        };
      }

      const maxRetries = WEBHOOK_CONFIG?.STRIPE?.RETRY_CONFIG?.MAX_ATTEMPTS || 3;
      if (webhookEvent.retry_count >= maxRetries) {
        throw new Error('Maximum retry attempts exceeded');
      }

      const event = {
        id: webhookEvent.stripe_event_id,
        type: webhookEvent.event_type,
        data: webhookEvent.data,
        api_version: '2023-10-16',
        created: Math.floor(webhookEvent.created_at.getTime() / 1000),
        livemode: true
      } as StripeWebhookEvent;

      const processingResult = await this.handleWebhookEvent(event, requestId);

      await this.webhookRepository.update(
        eventId,
        {
          processed: processingResult.success,
          processed_at: processingResult.success ? new Date() : null,
          retry_count: webhookEvent.retry_count + 1,
          failure_reason: processingResult.success ? null : processingResult.message
        }
      );

      logger.info('Webhook event retry processed', {
        eventId,
        stripeEventId: webhookEvent.stripe_event_id,
        success: processingResult.success,
        retryCount: webhookEvent.retry_count + 1,
        requestId
      });

      return {
        success: processingResult.success,
        processed: processingResult.success,
        eventId: webhookEvent.stripe_event_id,
        message: processingResult.message
      };
    } catch (error) {
      logger.error('Failed to retry webhook event', {
        eventId,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      return {
        success: false,
        processed: false,
        eventId: null,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async retryWebhookEvent(eventId: string, requestId: string): Promise<WebhookProcessingResult> {
    const numericEventId = parseInt(eventId);
    if (isNaN(numericEventId)) {
      return {
        success: false,
        processed: false,
        eventId: null,
        message: 'Invalid event ID'
      };
    }
    return this.retryFailedWebhookEvent(numericEventId, requestId);
  }

  async getWebhookEventStatus(eventId: string, requestId: string): Promise<any> {
    try {
      const numericEventId = parseInt(eventId);
      if (isNaN(numericEventId)) {
        throw new Error('Invalid event ID');
      }

      const webhookEvent = await this.webhookRepository.findById(numericEventId);
      
      if (!webhookEvent) {
        return null;
      }

      return {
        id: webhookEvent.id,
        stripeEventId: webhookEvent.stripe_event_id,
        eventType: webhookEvent.event_type,
        processed: webhookEvent.processed,
        retryCount: webhookEvent.retry_count,
        failureReason: webhookEvent.failure_reason || undefined,
        metadata: webhookEvent.metadata || undefined,
        createdAt: webhookEvent.created_at.toISOString(),
        processedAt: webhookEvent.processed_at?.toISOString()
      };
    } catch (error) {
      logger.error('Failed to get webhook event status', {
        eventId,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  async listWebhookEvents(filters: any, requestId: string): Promise<any> {
    try {
      const events = await this.webhookRepository.findByEventType(
        filters.eventType,
        filters.processed,
        filters.limit || 50
      );

      const totalCount = events.length;

      return {
        events: events.map(event => ({
          id: event.id,
          stripeEventId: event.stripe_event_id,
          eventType: event.event_type,
          processed: event.processed,
          retryCount: event.retry_count,
          failureReason: event.failure_reason || undefined,
          createdAt: event.created_at.toISOString(),
          processedAt: event.processed_at?.toISOString()
        })),
        totalCount,
        page: Math.floor((filters.offset || 0) / (filters.limit || 50)) + 1,
        limit: filters.limit || 50
      };
    } catch (error) {
      logger.error('Failed to list webhook events', {
        filters,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  async getWebhookStats(filters: any, requestId: string): Promise<any> {
    try {
      const stats = await this.webhookRepository.getProcessingStats();
      
      return {
        totalEvents: stats.total_events,
        processedEvents: stats.processed_events,
        pendingEvents: stats.pending_events,
        failedEvents: stats.total_events - stats.processed_events - stats.pending_events,
        eventsByType: stats.events_by_type,
        processingRate: stats.total_events > 0 ? (stats.processed_events / stats.total_events) * 100 : 0,
        averageProcessingTime: 0, // This would need to be calculated based on created_at and processed_at
        lastProcessedAt: new Date().toISOString() // This would need to be the latest processed_at from events
      };
    } catch (error) {
      logger.error('Failed to get webhook stats', {
        filters,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  async deleteWebhookEvent(eventId: string, requestId: string): Promise<boolean> {
    try {
      const numericEventId = parseInt(eventId);
      if (isNaN(numericEventId)) {
        throw new Error('Invalid event ID');
      }

      const deleted = await this.webhookRepository.delete(numericEventId);

      if (deleted) {
        logger.info('Webhook event deleted', {
          eventId: numericEventId,
          requestId
        });
      }

      return deleted;
    } catch (error) {
      logger.error('Failed to delete webhook event', {
        eventId,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  async getUnprocessedEvents(limit: number = 100, requestId?: string): Promise<WebhookEventDatabaseRecord[]> {
    try {
      const unprocessedEvents = await this.webhookRepository.findUnprocessed(limit);

      logger.info('Unprocessed webhook events retrieved', {
        count: unprocessedEvents.length,
        limit,
        requestId
      });

      return unprocessedEvents;
    } catch (error) {
      logger.error('Failed to get unprocessed webhook events', {
        limit,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  async markEventAsProcessed(eventId: number, requestId: string): Promise<WebhookEventDatabaseRecord> {
    try {
      const updatedEvent = await this.webhookRepository.markAsProcessed(eventId);

      logger.info('Webhook event marked as processed', {
        eventId,
        stripeEventId: updatedEvent.stripe_event_id,
        requestId
      });

      return updatedEvent;
    } catch (error) {
      logger.error('Failed to mark webhook event as processed', {
        eventId,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  async cleanupOldEvents(olderThanDays: number = 90, requestId?: string): Promise<number> {
    try {
      const deletedCount = await this.webhookRepository.deleteOldEvents(olderThanDays);

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

  async getEventsByDateRange(
    startDate: Date,
    endDate: Date,
    eventType?: string,
    requestId?: string
  ): Promise<WebhookEventDatabaseRecord[]> {
    try {
      const events = await this.webhookRepository.findByDateRange(startDate, endDate, eventType);

      logger.info('Webhook events by date range retrieved', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        eventType,
        count: events.length,
        requestId
      });

      return events;
    } catch (error) {
      logger.error('Failed to get webhook events by date range', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        eventType,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }
}

