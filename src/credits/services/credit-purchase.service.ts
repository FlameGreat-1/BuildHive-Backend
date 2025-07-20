import { CreditPurchaseRepository } from '../repositories';
import { 
  CreditPurchase,
  CreditPurchaseRequest,
  CreditPurchaseResponse,
  CreditPurchaseHistory,
  CreditPurchaseCalculation,
  CreditPurchaseReceipt,
  BusinessDetails
} from '../types';
import { CreditPurchaseModel } from '../models';
import { CreditService } from './credit.service';
import { CreditTransactionService } from './credit-transaction.service';
import { CreditNotificationService } from './credit-notification.service';
import { StripeService } from '../../payment/services/stripe.service';
import { ApplePayService } from '../../payment/services/apple-pay.service';
import { GooglePayService } from '../../payment/services/google-pay.service';
import { 
  calculateCreditPurchase,
  generatePurchaseId,
  validateCreditPurchase,
  validatePromoCode
} from '../utils';
import { logger } from '../../shared/utils';
import { 
  CreditPackageType,
  CreditTransactionStatus,
  CreditTransactionType,
  PaymentMethod,
  PaymentType
} from '../../shared/types';
import { 
  CREDIT_PACKAGES,
  BUSINESS_DETAILS
} from '../../config/credits';

export class CreditPurchaseService {
  private purchaseRepository: CreditPurchaseRepository;
  private creditService: CreditService;
  private transactionService: CreditTransactionService;
  private notificationService: CreditNotificationService;
  private stripeService: StripeService;
  private applePayService: ApplePayService;
  private googlePayService: GooglePayService;

  constructor() {
    this.purchaseRepository = new CreditPurchaseRepository();
    this.creditService = new CreditService();
    this.transactionService = new CreditTransactionService();
    this.notificationService = new CreditNotificationService();
    this.stripeService = new StripeService();
    this.applePayService = new ApplePayService();
    this.googlePayService = new GooglePayService();
  }

  async initiatePurchase(
    userId: number,
    request: CreditPurchaseRequest
  ): Promise<CreditPurchaseResponse> {
    try {
      const validation = validateCreditPurchase({
        packageType: request.packageType,
        userId,
        userRole: 'tradie',
        currentBalance: 0,
        dailySpent: 0,
        monthlySpent: 0,
        paymentMethodId: request.paymentMethodId
      });

      if (!validation.valid) {
        throw new Error(validation.reason);
      }

      if (request.promoCode) {
        const promoValidation = validatePromoCode(
          request.promoCode,
          request.packageType,
          userId
        );

        if (!promoValidation.valid) {
          throw new Error(promoValidation.reason);
        }
      }

      const purchase = CreditPurchaseModel.fromRequest(userId, request);
      const createdPurchase = await this.purchaseRepository.createPurchase(purchase.toJSON());

      const calculation = calculateCreditPurchase(request.packageType, request.promoCode);

      const paymentIntent = await this.stripeService.createPaymentIntent({
        amount: Math.round(calculation.finalAmount * 100),
        currency: 'aud',
        paymentMethod: PaymentMethod.STRIPE_CARD,
        paymentType: PaymentType.CREDIT_PURCHASE,
        metadata: {
          purchaseId: createdPurchase.id.toString(),
          userId: userId.toString(),
          packageType: request.packageType,
          credits: calculation.totalCredits.toString()
        }
      });

      await this.purchaseRepository.updatePurchaseStatus(
        createdPurchase.id,
        CreditTransactionStatus.PENDING,
        undefined,
        {
          paymentIntentId: paymentIntent.paymentIntentId,
          clientSecret: paymentIntent.clientSecret
        }
      );

      logger.info('Credit purchase initiated', {
        userId,
        purchaseId: createdPurchase.id,
        packageType: request.packageType,
        amount: calculation.finalAmount,
        paymentIntentId: paymentIntent.paymentIntentId
      });

      return createdPurchase.toResponse(paymentIntent.paymentIntentId, paymentIntent.clientSecret || '');
    } catch (error) {
      logger.error('Failed to initiate credit purchase', {
        userId,
        request,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async completePurchase(
    purchaseId: number,
    paymentId: number,
    paymentIntentId: string
  ): Promise<CreditPurchaseModel> {
    try {
      const purchase = await this.purchaseRepository.getPurchaseById(purchaseId);
      
      if (!purchase) {
        throw new Error('Purchase not found');
      }

      if (purchase.status !== CreditTransactionStatus.PENDING) {
        throw new Error('Purchase is not in pending status');
      }

      const paymentIntent = await this.stripeService.retrievePaymentIntent(paymentIntentId);
      
      if (paymentIntent.status !== 'succeeded') {
        throw new Error('Payment not successful');
      }

      const completedPurchase = await this.purchaseRepository.updatePurchaseStatus(
        purchaseId,
        CreditTransactionStatus.COMPLETED,
        paymentId,
        {
          paymentIntentId,
          paymentStatus: paymentIntent.status,
          completedAt: new Date()
        }
      );

      await this.creditService.addCredits(
        purchase.userId,
        purchase.getTotalCredits(),
        'purchase'
      );

      await this.transactionService.createTransaction(purchase.userId, {
        transactionType: CreditTransactionType.PURCHASE,
        credits: purchase.getTotalCredits(),
        description: `Credit purchase - ${CREDIT_PACKAGES[purchase.packageType].name}`,
        referenceId: purchaseId,
        referenceType: 'purchase',
        metadata: {
          purchaseId,
          packageType: purchase.packageType,
          paymentId,
          paymentIntentId
        }
      });

      await this.notificationService.sendPurchaseConfirmationNotification(
        purchase.userId,
        completedPurchase.toJSON()
      );

      if (purchase.hasAutoTopup()) {
        await this.setupAutoTopupFromPurchase(purchase);
      }

      logger.info('Credit purchase completed', {
        purchaseId,
        userId: purchase.userId,
        credits: purchase.getTotalCredits(),
        amount: purchase.purchasePrice,
        paymentId
      });

      return completedPurchase;
    } catch (error) {
      await this.purchaseRepository.updatePurchaseStatus(
        purchaseId,
        CreditTransactionStatus.FAILED,
        undefined,
        {
          failureReason: error instanceof Error ? error.message : 'Unknown error',
          failedAt: new Date()
        }
      );

      logger.error('Failed to complete credit purchase', {
        purchaseId,
        paymentId,
        paymentIntentId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async cancelPurchase(purchaseId: number, reason: string): Promise<CreditPurchaseModel> {
    try {
      const purchase = await this.purchaseRepository.getPurchaseById(purchaseId);
      
      if (!purchase) {
        throw new Error('Purchase not found');
      }

      if (purchase.status !== CreditTransactionStatus.PENDING) {
        throw new Error('Only pending purchases can be cancelled');
      }

      const paymentIntentId = purchase.getMetadata('paymentIntentId');
      if (paymentIntentId) {
        await this.stripeService.cancelPaymentIntent(paymentIntentId);
      }

      const cancelledPurchase = await this.purchaseRepository.updatePurchaseStatus(
        purchaseId,
        CreditTransactionStatus.CANCELLED,
        undefined,
        {
          cancellationReason: reason,
          cancelledAt: new Date()
        }
      );

      await this.notificationService.sendPurchaseCancellationNotification(
        purchase.userId,
        purchase.toJSON(),
        reason
      );

      logger.info('Credit purchase cancelled', {
        purchaseId,
        userId: purchase.userId,
        reason
      });

      return cancelledPurchase;
    } catch (error) {
      logger.error('Failed to cancel credit purchase', {
        purchaseId,
        reason,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async refundPurchase(
    purchaseId: number,
    refundAmount: number,
    reason: string
  ): Promise<void> {
    try {
      const purchase = await this.purchaseRepository.getPurchaseById(purchaseId);
      
      if (!purchase) {
        throw new Error('Purchase not found');
      }

      if (purchase.status !== CreditTransactionStatus.COMPLETED) {
        throw new Error('Only completed purchases can be refunded');
      }

      const paymentIntentId = purchase.getMetadata('paymentIntentId');
      if (!paymentIntentId) {
        throw new Error('Payment intent not found');
      }

      const refund = await this.stripeService.createRefund({
        payment_intent: paymentIntentId,
        amount: Math.round(refundAmount * 100),
        reason: 'requested_by_customer',
        metadata: {
          purchaseId: purchaseId.toString(),
          refundReason: reason
        }
      });

      const creditsToRefund = Math.floor(
        (refundAmount / purchase.purchasePrice) * purchase.getTotalCredits()
      );

      await this.creditService.deductCredits(
        purchase.userId,
        creditsToRefund,
        'refund'
      );

      await this.transactionService.createTransaction(purchase.userId, {
        transactionType: CreditTransactionType.REFUND,
        credits: creditsToRefund,
        description: `Refund for purchase #${purchaseId}: ${reason}`,
        referenceId: purchaseId,
        referenceType: 'purchase',
        metadata: {
          purchaseId,
          refundId: refund.id,
          refundAmount,
          refundReason: reason
        }
      });

      await this.purchaseRepository.updatePurchaseStatus(
        purchaseId,
        purchase.status,
        purchase.paymentId,
        {
          ...purchase.metadata,
          refundId: refund.id,
          refundAmount,
          refundReason: reason,
          refundedAt: new Date()
        }
      );

      await this.notificationService.sendRefundNotification(
        purchase.userId,
        creditsToRefund,
        reason
      );

      logger.info('Credit purchase refunded', {
        purchaseId,
        userId: purchase.userId,
        refundAmount,
        creditsRefunded: creditsToRefund,
        refundId: refund.id
      });
    } catch (error) {
      logger.error('Failed to refund credit purchase', {
        purchaseId,
        refundAmount,
        reason,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async getPurchaseById(purchaseId: number): Promise<CreditPurchaseModel | null> {
    try {
      return await this.purchaseRepository.getPurchaseById(purchaseId);
    } catch (error) {
      logger.error('Failed to get purchase by ID', {
        purchaseId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async getPurchaseHistory(
    userId: number,
    page: number = 1,
    limit: number = 10,
    status?: CreditTransactionStatus,
    packageType?: CreditPackageType,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<CreditPurchaseHistory> {
    try {
      return await this.purchaseRepository.getPurchaseHistory(
        userId,
        page,
        limit,
        status,
        packageType,
        dateFrom,
        dateTo
      );
    } catch (error) {
      logger.error('Failed to get purchase history', {
        userId,
        page,
        limit,
        status,
        packageType,
        dateFrom,
        dateTo,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async calculatePurchase(
    packageType: CreditPackageType,
    promoCode?: string
  ): Promise<CreditPurchaseCalculation> {
    try {
      return calculateCreditPurchase(packageType, promoCode);
    } catch (error) {
      logger.error('Failed to calculate purchase', {
        packageType,
        promoCode,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async generateReceipt(purchaseId: number): Promise<CreditPurchaseReceipt> {
    try {
      const purchase = await this.purchaseRepository.getPurchaseById(purchaseId);
      
      if (!purchase) {
        throw new Error('Purchase not found');
      }

      if (purchase.status !== CreditTransactionStatus.COMPLETED) {
        throw new Error('Receipt can only be generated for completed purchases');
      }

      return purchase.toReceipt(BUSINESS_DETAILS);
    } catch (error) {
      logger.error('Failed to generate receipt', {
        purchaseId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async processApplePayPurchase(
    userId: number,
    request: CreditPurchaseRequest,
    applePayToken: string
  ): Promise<CreditPurchaseResponse> {
    try {
      const calculation = calculateCreditPurchase(request.packageType, request.promoCode);
      
      const purchase = CreditPurchaseModel.fromRequest(userId, request);
      const createdPurchase = await this.purchaseRepository.createPurchase(purchase.toJSON());

      const applePayResult = await this.applePayService.processPayment({
        amount: calculation.finalAmount,
        currency: 'AUD',
        token: applePayToken,
        metadata: {
          purchaseId: createdPurchase.id.toString(),
          userId: userId.toString(),
          packageType: request.packageType
        }
      });

      if (applePayResult.success) {
        await this.completePurchase(
          createdPurchase.id,
          applePayResult.paymentId!,
          applePayResult.transactionId!
        );
      } else {
        await this.purchaseRepository.updatePurchaseStatus(
          createdPurchase.id,
          CreditTransactionStatus.FAILED,
          undefined,
          { failureReason: applePayResult.error }
        );
        throw new Error(applePayResult.error);
      }

      return createdPurchase.toResponse(applePayResult.transactionId!, '');
    } catch (error) {
      logger.error('Failed to process Apple Pay purchase', {
        userId,
        request,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async processGooglePayPurchase(
    userId: number,
    request: CreditPurchaseRequest,
    googlePayToken: string
  ): Promise<CreditPurchaseResponse> {
    try {
      const calculation = calculateCreditPurchase(request.packageType, request.promoCode);
      
      const purchase = CreditPurchaseModel.fromRequest(userId, request);
      const createdPurchase = await this.purchaseRepository.createPurchase(purchase.toJSON());

      const googlePayResult = await this.googlePayService.processPayment({
        amount: calculation.finalAmount,
        currency: 'AUD',
        token: googlePayToken,
        metadata: {
          purchaseId: createdPurchase.id.toString(),
          userId: userId.toString(),
          packageType: request.packageType
        }
      });

      if (googlePayResult.success) {
        await this.completePurchase(
          createdPurchase.id,
          googlePayResult.paymentId!,
          googlePayResult.transactionId!
        );
      } else {
        await this.purchaseRepository.updatePurchaseStatus(
          createdPurchase.id,
          CreditTransactionStatus.FAILED,
          undefined,
          { failureReason: googlePayResult.error }
        );
        throw new Error(googlePayResult.error);
      }

      return createdPurchase.toResponse(googlePayResult.transactionId!, '');
    } catch (error) {
      logger.error('Failed to process Google Pay purchase', {
        userId,
        request,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  private async setupAutoTopupFromPurchase(purchase: CreditPurchaseModel): Promise<void> {
    try {
      logger.info('Setting up auto topup from purchase', {
        purchaseId: purchase.id,
        userId: purchase.userId,
        packageType: purchase.packageType
      });
    } catch (error) {
      logger.error('Failed to setup auto topup from purchase', {
        purchaseId: purchase.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
