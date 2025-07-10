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

export class WebhookService {
  private webhookRepository: WebhookRepository;
  private paymentRepository: PaymentRepository;
  private refundRepository: RefundRepository;
  private invoiceRepository: InvoiceRepository;

  constructor() {
    this.initializeRepositories();
  }

  private async initializeRepositories(): Promise<void> {
    const dbConnection = await getDbConnection();
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

      const existingEvent = await this.webhookRepository.getWebhookEventByStripeId(
        event.id,
        requestId
      );

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

      const webhookEventData = {
        stripeEventId: event.id,
        eventType: event.type,
        data: event.data,
        processed: false,
        retryCount: 0,
        metadata: {
          apiVersion: event.api_version,
          created: event.created,
          livemode: event.livemode,
          requestId
        }
      };

      const savedEvent = await this.webhookRepository.createWebhookEvent(
        webhookEventData,
        requestId
      );

      const processingResult = await this.handleWebhookEvent(event, requestId);

      await this.webhookRepository.updateWebhookEvent(
        savedEvent.id,
        {
          processed: processingResult.success,
          processedAt: new Date(),
          processingResult: processingResult.message
        },
        requestId
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
        case WebhookEventType.PAYMENT_INTENT_SUCCEEDED:
          return await this.handlePaymentIntentSucceeded(event, requestId);

        case WebhookEventType.PAYMENT_INTENT_PAYMENT_FAILED:
          return await this.handlePaymentIntentFailed(event, requestId);

        case WebhookEventType.PAYMENT_INTENT_CANCELED:
          return await this.handlePaymentIntentCanceled(event, requestId);

        case WebhookEventType.PAYMENT_METHOD_ATTACHED:
          return await this.handlePaymentMethodAttached(event, requestId);

        case WebhookEventType.CHARGE_DISPUTE_CREATED:
          return await this.handleChargeDisputeCreated(event, requestId);

        case WebhookEventType.INVOICE_PAYMENT_SUCCEEDED:
          return await this.handleInvoicePaymentSucceeded(event, requestId);

        case WebhookEventType.INVOICE_PAYMENT_FAILED:
          return await this.handleInvoicePaymentFailed(event, requestId);

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
      const payment = await this.paymentRepository.getPaymentByStripeId(
        paymentIntent.id,
        requestId
      );

      if (!payment) {
        return {
          success: false,
          message: 'Payment not found for payment intent'
        };
      }

      await this.paymentRepository.updatePaymentStatus(
        payment.id,
        'completed',
        requestId
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
      const payment = await this.paymentRepository.getPaymentByStripeId(
        paymentIntent.id,
        requestId
      );

      if (!payment) {
        return {
          success: false,
          message: 'Payment not found for payment intent'
        };
      }

      await this.paymentRepository.updatePaymentStatus(
        payment.id,
        'failed',
        requestId
      );

      logger.info('Payment intent failed processed', {
        paymentIntentId: paymentIntent.id,
        paymentId: payment.id,
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
      const payment = await this.paymentRepository.getPaymentByStripeId(
        paymentIntent.id,
        requestId
      );

      if (!payment) {
        return {
          success: false,
          message: 'Payment not found for payment intent'
        };
      }

      await this.paymentRepository.updatePaymentStatus(
        payment.id,
        'cancelled',
        requestId
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
        requestId
      });

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
      
      logger.info('Invoice payment succeeded processed', {
        invoiceId: invoice.id,
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
      
      logger.warn('Invoice payment failed processed', {
        invoiceId: invoice.id,
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

  async retryFailedWebhookEvent(eventId: number, requestId: string): Promise<WebhookProcessingResult> {
    try {
      const webhookEvent = await this.webhookRepository.getWebhookEventById(eventId, requestId);

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

      if (webhookEvent.retry_count >= WEBHOOK_CONFIG.STRIPE.RETRY_CONFIG.MAX_ATTEMPTS) {
        throw new Error('Maximum retry attempts exceeded');
      }

      const event = {
        id: webhookEvent.stripe_event_id,
        type: webhookEvent.event_type,
        data: webhookEvent.data
      } as StripeWebhookEvent;

      const processingResult = await this.handleWebhookEvent(event, requestId);

      await this.webhookRepository.updateWebhookEvent(
        eventId,
        {
          processed: processingResult.success,
          processedAt: processingResult.success ? new Date() : undefined,
          retryCount: webhookEvent.retry_count + 1,
          processingResult: processingResult.message
        },
        requestId
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
}
