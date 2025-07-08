import Stripe from 'stripe';
import { 
  PaymentIntegrationService,
  PaymentIntentData,
  PaymentIntentResponse,
  PaymentConfirmationData,
  PaymentResult,
  RefundData,
  RefundResult,
  InvoiceData,
  InvoiceResult,
  PaymentWebhookData,
  PaymentFeeCalculation,
  PaymentMethodData,
  PaymentHistoryItem,
  PaymentAnalytics,
  PaymentNotificationData,
  PaymentStatus,
  RefundStatus,
  InvoiceStatus
} from '../types/payment.types';
import { paymentRepository, PaymentRepository } from '../repositories/payment.repository';
import { environment } from '../../config/auth';
import { PAYMENT_CONSTANTS } from '../../config/quotes';
import { logger } from '../../shared/utils';
import { AppError } from '../../shared/utils';
import { HTTP_STATUS_CODES } from '../../config/auth';

export class PaymentIntegrationServiceImpl implements PaymentIntegrationService {
  private stripe: Stripe;
  private paymentRepo: PaymentRepository;

  constructor() {
    this.stripe = new Stripe(environment.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16'
    });
    this.paymentRepo = paymentRepository;
  }

  async createPaymentIntent(data: PaymentIntentData): Promise<PaymentIntentResponse> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(data.amount * 100), // Convert to cents
        currency: data.currency.toLowerCase(),
        description: data.description,
        metadata: {
          quoteId: data.quoteId.toString(),
          quoteNumber: data.metadata.quoteNumber,
          clientId: data.clientId.toString(),
          tradieId: data.tradieId.toString(),
          jobId: data.metadata.jobId?.toString() || '',
          clientEmail: data.metadata.clientEmail,
          tradieEmail: data.metadata.tradieEmail
        },
        automatic_payment_methods: {
          enabled: true
        },
        capture_method: 'automatic',
        confirmation_method: 'automatic'
      });

      // Save payment intent to database using repository
      await this.paymentRepo.createPaymentIntent({
        ...data,
        metadata: {
          ...data.metadata,
          quoteNumber: paymentIntent.id // Update with actual Stripe payment intent ID
        }
      });

      logger.info('Payment intent created successfully', {
        paymentIntentId: paymentIntent.id,
        quoteId: data.quoteId,
        amount: data.amount,
        currency: data.currency
      });

      return {
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret!,
        amount: data.amount,
        currency: data.currency,
        status: paymentIntent.status as any,
        createdAt: new Date(paymentIntent.created * 1000)
      };

    } catch (error) {
      logger.error('Failed to create payment intent', {
        quoteId: data.quoteId,
        amount: data.amount,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new AppError(
        'Failed to create payment intent',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'PAYMENT_INTENT_CREATION_ERROR'
      );
    }
  }

  async confirmPayment(data: PaymentConfirmationData): Promise<PaymentResult> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.confirm(data.paymentIntentId, {
        payment_method: data.paymentMethodId,
        return_url: `${environment.FRONTEND_URL}/quotes/payment-success`
      });

      const result: PaymentResult = {
        success: paymentIntent.status === 'succeeded',
        paymentId: paymentIntent.id,
        transactionId: paymentIntent.charges.data[0]?.id || '',
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency.toUpperCase(),
        status: this.mapStripeStatusToPaymentStatus(paymentIntent.status),
        paidAt: paymentIntent.status === 'succeeded' ? new Date() : undefined,
        receiptUrl: paymentIntent.charges.data[0]?.receipt_url || undefined
      };

      // Update payment status using repository
      if (paymentIntent.status === 'succeeded') {
        await this.paymentRepo.updatePaymentStatus(
          data.quoteId, 
          'succeeded', 
          paymentIntent.id,
          paymentIntent.charges.data[0]?.payment_method_details?.type || 'card'
        );
        
        await this.publishPaymentNotification({
          quoteId: data.quoteId,
          clientId: data.clientId,
          tradieId: data.tradieId,
          paymentStatus: 'succeeded',
          amount: result.amount,
          currency: result.currency,
          eventType: 'payment_succeeded'
        });
      } else if (paymentIntent.status === 'requires_action') {
        result.failureReason = 'Additional authentication required';
      } else if (paymentIntent.status === 'payment_failed') {
        await this.paymentRepo.updatePaymentStatus(
          data.quoteId, 
          'failed', 
          paymentIntent.id,
          undefined,
          paymentIntent.last_payment_error?.message || 'Payment failed'
        );
      }

      logger.info('Payment confirmation processed', {
        paymentIntentId: data.paymentIntentId,
        quoteId: data.quoteId,
        status: paymentIntent.status,
        success: result.success
      });

      return result;

    } catch (error) {
      logger.error('Failed to confirm payment', {
        paymentIntentId: data.paymentIntentId,
        quoteId: data.quoteId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Update payment status to failed using repository
      await this.paymentRepo.updatePaymentStatus(
        data.quoteId, 
        'failed',
        data.paymentIntentId,
        undefined,
        error instanceof Error ? error.message : 'Payment confirmation failed'
      );

      return {
        success: false,
        paymentId: data.paymentIntentId,
        transactionId: '',
        amount: data.amount,
        currency: data.currency,
        status: 'failed',
        failureReason: error instanceof Error ? error.message : 'Payment confirmation failed'
      };
    }
  }

  async processRefund(data: RefundData): Promise<RefundResult> {
    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: data.paymentId,
        amount: data.amount ? Math.round(data.amount * 100) : undefined,
        reason: this.mapRefundReasonToStripe(data.reason),
        metadata: {
          quoteId: data.quoteId.toString(),
          tradieId: data.tradieId.toString(),
          clientId: data.clientId.toString(),
          refundReason: data.reason
        }
      });

      const result: RefundResult = {
        success: refund.status === 'succeeded',
        refundId: refund.id,
        amount: refund.amount / 100,
        currency: refund.currency.toUpperCase(),
        status: this.mapStripeRefundStatusToRefundStatus(refund.status),
        processedAt: refund.status === 'succeeded' ? new Date() : undefined
      };

      // Update refund status using repository
      if (refund.status === 'succeeded') {
        await this.paymentRepo.updateRefundStatus(data.quoteId, refund.id, 'succeeded');
        
        await this.publishPaymentNotification({
          quoteId: data.quoteId,
          clientId: data.clientId,
          tradieId: data.tradieId,
          paymentStatus: 'refunded',
          amount: result.amount,
          currency: result.currency,
          eventType: 'refund_processed'
        });
      } else {
        await this.paymentRepo.updateRefundStatus(data.quoteId, refund.id, 'pending');
      }

      logger.info('Refund processed successfully', {
        refundId: refund.id,
        quoteId: data.quoteId,
        amount: result.amount,
        status: refund.status
      });

      return result;

    } catch (error) {
      logger.error('Failed to process refund', {
        paymentId: data.paymentId,
        quoteId: data.quoteId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new AppError(
        'Failed to process refund',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'REFUND_PROCESSING_ERROR'
      );
    }
  }

  async generateInvoice(data: InvoiceData): Promise<InvoiceResult> {
    try {
      const customer = await this.getOrCreateStripeCustomer(data.clientId);
      
      const invoice = await this.stripe.invoices.create({
        customer: customer.id,
        description: `Invoice for Quote #${data.metadata.quoteNumber}`,
        metadata: {
          quoteId: data.quoteId.toString(),
          paymentId: data.paymentId,
          tradieId: data.tradieId.toString(),
          jobId: data.metadata.jobId?.toString() || ''
        },
        auto_advance: true,
        collection_method: 'send_invoice',
        days_until_due: 30
      });

      for (const item of data.items) {
        await this.stripe.invoiceItems.create({
          customer: customer.id,
          invoice: invoice.id,
          description: item.description,
          quantity: item.quantity,
          unit_amount: Math.round(item.unitPrice * 100),
          currency: data.currency.toLowerCase()
        });
      }

      const finalizedInvoice = await this.stripe.invoices.finalizeInvoice(invoice.id);
      
      const result: InvoiceResult = {
        success: true,
        invoiceId: finalizedInvoice.id,
        invoiceNumber: finalizedInvoice.number!,
        invoiceUrl: finalizedInvoice.hosted_invoice_url!,
        pdfUrl: finalizedInvoice.invoice_pdf!,
        status: this.mapStripeInvoiceStatusToInvoiceStatus(finalizedInvoice.status!),
        createdAt: new Date(finalizedInvoice.created * 1000)
      };

      // Save invoice record using repository
      await this.paymentRepo.saveInvoiceRecord(data.quoteId, finalizedInvoice.id, finalizedInvoice.number!);

      logger.info('Invoice generated successfully', {
        invoiceId: finalizedInvoice.id,
        quoteId: data.quoteId,
        amount: data.amount
      });

      return result;

    } catch (error) {
      logger.error('Failed to generate invoice', {
        quoteId: data.quoteId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new AppError(
        'Failed to generate invoice',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'INVOICE_GENERATION_ERROR'
      );
    }
  }

  calculateFees(amount: number): PaymentFeeCalculation {
    const stripeFee = (amount * PAYMENT_CONSTANTS.STRIPE_FEE_PERCENTAGE) + PAYMENT_CONSTANTS.STRIPE_FIXED_FEE;
    const platformFee = amount * PAYMENT_CONSTANTS.PLATFORM_FEE_PERCENTAGE;
    const totalFees = stripeFee + platformFee;
    const tradieAmount = amount - totalFees;

    return {
      subtotal: parseFloat(amount.toFixed(2)),
      stripeFee: parseFloat(stripeFee.toFixed(2)),
      platformFee: parseFloat(platformFee.toFixed(2)),
      tradieAmount: parseFloat(tradieAmount.toFixed(2)),
      totalFees: parseFloat(totalFees.toFixed(2))
    };
  }
  
    async handleWebhook(webhookData: PaymentWebhookData): Promise<void> {
    try {
      // Save webhook event using repository
      await this.paymentRepo.saveWebhookEvent(
        webhookData.paymentIntentId || webhookData.paymentId || `${Date.now()}`,
        webhookData.eventType,
        webhookData
      );

      switch (webhookData.eventType) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSuccess(webhookData);
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailure(webhookData);
          break;
        case 'payment_intent.canceled':
          await this.handlePaymentCancellation(webhookData);
          break;
        case 'refund.created':
        case 'refund.updated':
          await this.handleRefundUpdate(webhookData);
          break;
        case 'invoice.payment_succeeded':
          await this.handleInvoicePaymentSuccess(webhookData);
          break;
        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailure(webhookData);
          break;
        case 'charge.dispute.created':
          await this.handleChargeDispute(webhookData);
          break;
        default:
          logger.warn('Unhandled webhook event type', {
            eventType: webhookData.eventType,
            quoteId: webhookData.metadata.quoteId
          });
      }

      // Mark webhook as processed using repository
      await this.paymentRepo.markWebhookProcessed(
        webhookData.paymentIntentId || webhookData.paymentId || `${Date.now()}`
      );

      logger.info('Webhook processed successfully', {
        eventType: webhookData.eventType,
        quoteId: webhookData.metadata.quoteId
      });

    } catch (error) {
      logger.error('Failed to handle webhook', {
        eventType: webhookData.eventType,
        quoteId: webhookData.metadata.quoteId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new AppError(
        'Failed to process webhook',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'WEBHOOK_PROCESSING_ERROR'
      );
    }
  }

  async getPaymentHistory(userId: number, userType: 'client' | 'tradie'): Promise<PaymentHistoryItem[]> {
    try {
      return await this.paymentRepo.getPaymentHistory(userId, userType, 100, 0);
    } catch (error) {
      logger.error('Failed to get payment history', {
        userId,
        userType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new AppError(
        'Failed to retrieve payment history',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'PAYMENT_HISTORY_ERROR'
      );
    }
  }

  async getPaymentAnalytics(tradieId: number, startDate: Date, endDate: Date): Promise<PaymentAnalytics> {
    try {
      return await this.paymentRepo.getPaymentAnalytics(tradieId, startDate, endDate);
    } catch (error) {
      logger.error('Failed to get payment analytics', {
        tradieId,
        startDate,
        endDate,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new AppError(
        'Failed to retrieve payment analytics',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'PAYMENT_ANALYTICS_ERROR'
      );
    }
  }

  async validatePaymentMethod(paymentMethodId: string): Promise<boolean> {
    try {
      const paymentMethod = await this.stripe.paymentMethods.retrieve(paymentMethodId);
      return paymentMethod && paymentMethod.id === paymentMethodId;
    } catch (error) {
      logger.error('Failed to validate payment method', {
        paymentMethodId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  async savePaymentMethod(data: PaymentMethodData): Promise<void> {
    try {
      await this.paymentRepo.savePaymentMethod(data);

      logger.info('Payment method saved successfully', {
        clientId: data.clientId,
        paymentMethodId: data.paymentMethodId,
        type: data.type
      });

    } catch (error) {
      logger.error('Failed to save payment method', {
        clientId: data.clientId,
        paymentMethodId: data.paymentMethodId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new AppError(
        'Failed to save payment method',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'PAYMENT_METHOD_SAVE_ERROR'
      );
    }
  }

  private async getOrCreateStripeCustomer(clientId: number): Promise<Stripe.Customer> {
    try {
      // Get user payment methods to check if customer exists
      const paymentMethods = await this.paymentRepo.getUserPaymentMethods(clientId);
      
      // If we have payment methods, try to get the customer from Stripe
      if (paymentMethods.length > 0) {
        try {
          const customers = await this.stripe.customers.list({
            email: `client-${clientId}@temp.com`, // This should be actual email from user service
            limit: 1
          });
          
          if (customers.data.length > 0) {
            return customers.data[0];
          }
        } catch (error) {
          logger.warn('Failed to retrieve existing customer', { clientId, error });
        }
      }

      // Create new customer
      const customer = await this.stripe.customers.create({
        email: `client-${clientId}@temp.com`, // This should be actual email from user service
        metadata: { clientId: clientId.toString() }
      });

      return customer;

    } catch (error) {
      logger.error('Failed to get or create Stripe customer', {
        clientId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new AppError(
        'Failed to create customer',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'CUSTOMER_CREATION_ERROR'
      );
    }
  }

  private async handlePaymentSuccess(webhookData: PaymentWebhookData): Promise<void> {
    await this.paymentRepo.updatePaymentStatus(
      webhookData.metadata.quoteId, 
      'succeeded',
      webhookData.paymentId,
      'card' // Default to card, should be extracted from webhook data
    );
    
    await this.publishPaymentNotification({
      ...webhookData.metadata,
      paymentStatus: 'succeeded',
      amount: webhookData.amount,
      currency: webhookData.currency,
      eventType: 'payment_succeeded'
    });
  }

  private async handlePaymentFailure(webhookData: PaymentWebhookData): Promise<void> {
    await this.paymentRepo.updatePaymentStatus(
      webhookData.metadata.quoteId, 
      'failed',
      webhookData.paymentId,
      undefined,
      'Payment failed via webhook'
    );
    
    await this.publishPaymentNotification({
      ...webhookData.metadata,
      paymentStatus: 'failed',
      amount: webhookData.amount,
      currency: webhookData.currency,
      eventType: 'payment_failed'
    });
  }

  private async handlePaymentCancellation(webhookData: PaymentWebhookData): Promise<void> {
    await this.paymentRepo.updatePaymentStatus(
      webhookData.metadata.quoteId, 
      'canceled',
      webhookData.paymentId
    );
  }

  private async handleRefundUpdate(webhookData: PaymentWebhookData): Promise<void> {
    if (webhookData.refundId) {
      await this.paymentRepo.updateRefundStatus(
        webhookData.metadata.quoteId, 
        webhookData.refundId, 
        'succeeded'
      );
    }
  }

  private async handleInvoicePaymentSuccess(webhookData: PaymentWebhookData): Promise<void> {
    await this.paymentRepo.updatePaymentStatus(
      webhookData.metadata.quoteId, 
      'succeeded',
      webhookData.paymentId
    );
  }

  private async handleInvoicePaymentFailure(webhookData: PaymentWebhookData): Promise<void> {
    await this.paymentRepo.updatePaymentStatus(
      webhookData.metadata.quoteId, 
      'failed',
      webhookData.paymentId,
      undefined,
      'Invoice payment failed'
    );
  }

  private async handleChargeDispute(webhookData: PaymentWebhookData): Promise<void> {
    logger.warn('Charge dispute created', {
      quoteId: webhookData.metadata.quoteId,
      amount: webhookData.amount
    });
    
    // Could update payment status to disputed if needed
    // await this.paymentRepo.updatePaymentStatus(webhookData.metadata.quoteId, 'disputed');
  }

  private async publishPaymentNotification(data: PaymentNotificationData): Promise<void> {
    // This would integrate with notification service when available
    logger.info('Payment notification published', {
      quoteId: data.quoteId,
      paymentStatus: data.paymentStatus,
      eventType: data.eventType
    });
    
    // Future integration with notification service:
    // await notificationService.sendPaymentNotification(data);
  }

  private mapStripeStatusToPaymentStatus(stripeStatus: string): PaymentStatus {
    const statusMap: { [key: string]: PaymentStatus } = {
      'succeeded': 'succeeded',
      'processing': 'processing',
      'requires_payment_method': 'pending',
      'requires_confirmation': 'pending',
      'requires_action': 'pending',
      'canceled': 'canceled',
      'payment_failed': 'failed'
    };
    return statusMap[stripeStatus] || 'pending';
  }

  private mapStripeRefundStatusToRefundStatus(stripeStatus: string): RefundStatus {
    const statusMap: { [key: string]: RefundStatus } = {
      'succeeded': 'succeeded',
      'pending': 'pending',
      'failed': 'failed',
      'canceled': 'canceled'
    };
    return statusMap[stripeStatus] || 'pending';
  }

  private mapStripeInvoiceStatusToInvoiceStatus(stripeStatus: string): InvoiceStatus {
    const statusMap: { [key: string]: InvoiceStatus } = {
      'draft': 'draft',
      'open': 'open',
      'paid': 'paid',
      'void': 'void',
      'uncollectible': 'uncollectible'
    };
    return statusMap[stripeStatus] || 'draft';
  }

  private mapRefundReasonToStripe(reason: string): Stripe.RefundCreateParams.Reason {
    const reasonMap: { [key: string]: Stripe.RefundCreateParams.Reason } = {
      'requested_by_customer': 'requested_by_customer',
      'duplicate': 'duplicate',
      'fraudulent': 'fraudulent'
    };
    return reasonMap[reason] || 'requested_by_customer';
  }
}

export const paymentIntegrationService = new PaymentIntegrationServiceImpl();

