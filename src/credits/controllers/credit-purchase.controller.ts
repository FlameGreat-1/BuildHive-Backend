import { Request, Response } from 'express';
import { CreditPurchaseService, CreditService } from '../services';
import { 
  sendSuccessResponse,
  sendErrorResponse,
  sendNotFoundError,
  sendBadRequestError,
  sendInternalServerError
} from '../../shared/utils';
import { logger } from '../../shared/utils';
import { 
  CreditPurchaseRequest,
  CreditPurchaseHistory,
  CreditPurchaseCalculation
} from '../types';
import { CreditPackageType, CreditTransactionStatus } from '../../shared/types';

export class CreditPurchaseController {
  private purchaseService: CreditPurchaseService;
  private creditService: CreditService;

  constructor() {
    this.purchaseService = new CreditPurchaseService();
    this.creditService = new CreditService();
  }

  async initiatePurchase(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id ? parseInt(req.user.id) : undefined;
      const { packageType, paymentMethodId, autoTopup, promoCode } = req.body;
      const requestId = res.locals.requestId;

      if (!userId) {
        sendBadRequestError(res, 'User ID is required');
        return;
      }

      const purchaseRequest: CreditPurchaseRequest = {
        packageType,
        paymentMethodId,
        autoTopup,
        promoCode
      };

      const purchaseResponse = await this.purchaseService.initiatePurchase(userId, purchaseRequest);

      logger.info('Credit purchase initiated', {
        requestId,
        userId,
        purchaseId: purchaseResponse.purchaseId,
        packageType,
        totalCredits: purchaseResponse.totalCredits,
        purchasePrice: purchaseResponse.purchasePrice
      });

      sendSuccessResponse(res, 'Credit purchase initiated successfully', {
        purchase: purchaseResponse
      });
    } catch (error) {
      const requestId = res.locals.requestId;
      logger.error('Failed to initiate credit purchase', {
        requestId,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      sendInternalServerError(res, 'Failed to initiate credit purchase');
    }
  }

  async completePurchase(req: Request, res: Response): Promise<void> {
    try {
      const { purchaseId } = req.params;
      const { paymentId, paymentIntentId } = req.body;
      const requestId = res.locals.requestId;

      if (!purchaseId) {
        sendBadRequestError(res, 'Purchase ID is required');
        return;
      }

      if (!paymentId || !paymentIntentId) {
        sendBadRequestError(res, 'Payment ID and Payment Intent ID are required');
        return;
      }

      const completedPurchase = await this.purchaseService.completePurchase(
        parseInt(purchaseId),
        paymentId,
        paymentIntentId
      );

      logger.info('Credit purchase completed', {
        requestId,
        purchaseId: completedPurchase.id,
        userId: completedPurchase.userId,
        totalCredits: completedPurchase.getTotalCredits(),
        purchasePrice: completedPurchase.purchasePrice
      });

      sendSuccessResponse(res, 'Credit purchase completed successfully', {
        purchase: completedPurchase.toJSON()
      });
    } catch (error) {
      const requestId = res.locals.requestId;
      logger.error('Failed to complete credit purchase', {
        requestId,
        purchaseId: req.params.purchaseId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      sendInternalServerError(res, 'Failed to complete credit purchase');
    }
  }

  async cancelPurchase(req: Request, res: Response): Promise<void> {
    try {
      const { purchaseId } = req.params;
      const { reason } = req.body;
      const requestId = res.locals.requestId;

      if (!purchaseId) {
        sendBadRequestError(res, 'Purchase ID is required');
        return;
      }

      if (!reason) {
        sendBadRequestError(res, 'Cancellation reason is required');
        return;
      }

      const cancelledPurchase = await this.purchaseService.cancelPurchase(
        parseInt(purchaseId),
        reason
      );

      logger.info('Credit purchase cancelled', {
        requestId,
        purchaseId: cancelledPurchase.id,
        userId: cancelledPurchase.userId,
        reason
      });

      sendSuccessResponse(res, 'Credit purchase cancelled successfully', {
        purchase: cancelledPurchase.toJSON()
      });
    } catch (error) {
      const requestId = res.locals.requestId;
      logger.error('Failed to cancel credit purchase', {
        requestId,
        purchaseId: req.params.purchaseId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      sendInternalServerError(res, 'Failed to cancel credit purchase');
    }
  }

  async refundPurchase(req: Request, res: Response): Promise<void> {
    try {
      const { purchaseId } = req.params;
      const { refundAmount, reason } = req.body;
      const requestId = res.locals.requestId;

      if (!purchaseId) {
        sendBadRequestError(res, 'Purchase ID is required');
        return;
      }

      if (!refundAmount || !reason) {
        sendBadRequestError(res, 'Refund amount and reason are required');
        return;
      }

      await this.purchaseService.refundPurchase(
        parseInt(purchaseId),
        refundAmount,
        reason
      );

      logger.info('Credit purchase refunded', {
        requestId,
        purchaseId,
        refundAmount,
        reason
      });

      sendSuccessResponse(res, 'Credit purchase refunded successfully');
    } catch (error) {
      const requestId = res.locals.requestId;
      logger.error('Failed to refund credit purchase', {
        requestId,
        purchaseId: req.params.purchaseId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      sendInternalServerError(res, 'Failed to refund credit purchase');
    }
  }

  async getPurchaseById(req: Request, res: Response): Promise<void> {
    try {
      const { purchaseId } = req.params;
      const requestId = res.locals.requestId;

      if (!purchaseId) {
        sendBadRequestError(res, 'Purchase ID is required');
        return;
      }

      const purchase = await this.purchaseService.getPurchaseById(parseInt(purchaseId));

      if (!purchase) {
        sendNotFoundError(res, 'Purchase not found');
        return;
      }

      logger.info('Credit purchase retrieved', {
        requestId,
        purchaseId: purchase.id,
        userId: purchase.userId
      });

      sendSuccessResponse(res, 'Credit purchase retrieved successfully', {
        purchase: purchase.toJSON()
      });
    } catch (error) {
      const requestId = res.locals.requestId;
      logger.error('Failed to get credit purchase', {
        requestId,
        purchaseId: req.params.purchaseId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      sendInternalServerError(res, 'Failed to retrieve credit purchase');
    }
  }

  async getPurchaseHistory(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id ? parseInt(req.user.id) : undefined;
      const { 
        page = 1, 
        limit = 10, 
        status, 
        packageType, 
        dateFrom, 
        dateTo 
      } = req.query;
      const requestId = res.locals.requestId;

      if (!userId) {
        sendBadRequestError(res, 'User ID is required');
        return;
      }

      const history = await this.purchaseService.getPurchaseHistory(
        userId,
        parseInt(page as string),
        parseInt(limit as string),
        status as CreditTransactionStatus,
        packageType as CreditPackageType,
        dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo ? new Date(dateTo as string) : undefined
      );

      logger.info('Credit purchase history retrieved', {
        requestId,
        userId,
        totalPurchases: history.totalPurchases,
        page,
        limit
      });

      sendSuccessResponse(res, 'Credit purchase history retrieved successfully', {
        history
      });
    } catch (error) {
      const requestId = res.locals.requestId;
      logger.error('Failed to get credit purchase history', {
        requestId,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      sendInternalServerError(res, 'Failed to retrieve credit purchase history');
    }
  }

  async calculatePurchase(req: Request, res: Response): Promise<void> {
    try {
      const { packageType, promoCode } = req.body;
      const requestId = res.locals.requestId;

      if (!packageType) {
        sendBadRequestError(res, 'Package type is required');
        return;
      }

      const calculation = await this.purchaseService.calculatePurchase(packageType, promoCode);

      logger.info('Credit purchase calculated', {
        requestId,
        packageType,
        promoCode,
        finalAmount: calculation.finalAmount,
        totalCredits: calculation.totalCredits
      });

      sendSuccessResponse(res, 'Credit purchase calculated successfully', {
        calculation
      });
    } catch (error) {
      const requestId = res.locals.requestId;
      logger.error('Failed to calculate credit purchase', {
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      sendInternalServerError(res, 'Failed to calculate credit purchase');
    }
  }

  async generateReceipt(req: Request, res: Response): Promise<void> {
    try {
      const { purchaseId } = req.params;
      const requestId = res.locals.requestId;

      if (!purchaseId) {
        sendBadRequestError(res, 'Purchase ID is required');
        return;
      }

      const receipt = await this.purchaseService.generateReceipt(parseInt(purchaseId));

      logger.info('Credit purchase receipt generated', {
        requestId,
        purchaseId,
        receiptNumber: receipt.receiptNumber
      });

      sendSuccessResponse(res, 'Credit purchase receipt generated successfully', {
        receipt
      });
    } catch (error) {
      const requestId = res.locals.requestId;
      logger.error('Failed to generate credit purchase receipt', {
        requestId,
        purchaseId: req.params.purchaseId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      sendInternalServerError(res, 'Failed to generate credit purchase receipt');
    }
  }

  async processApplePayPurchase(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id ? parseInt(req.user.id) : undefined;
      const { packageType, applePayToken, promoCode } = req.body;
      const requestId = res.locals.requestId;

      if (!userId) {
        sendBadRequestError(res, 'User ID is required');
        return;
      }

      if (!packageType || !applePayToken) {
        sendBadRequestError(res, 'Package type and Apple Pay token are required');
        return;
      }

      const purchaseRequest: CreditPurchaseRequest = {
        packageType,
        promoCode
      };

      const purchaseResponse = await this.purchaseService.processApplePayPurchase(
        userId,
        purchaseRequest,
        applePayToken
      );

      logger.info('Apple Pay credit purchase processed', {
        requestId,
        userId,
        purchaseId: purchaseResponse.purchaseId,
        packageType,
        totalCredits: purchaseResponse.totalCredits
      });

      sendSuccessResponse(res, 'Apple Pay credit purchase processed successfully', {
        purchase: purchaseResponse
      });
    } catch (error) {
      const requestId = res.locals.requestId;
      logger.error('Failed to process Apple Pay credit purchase', {
        requestId,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      sendInternalServerError(res, 'Failed to process Apple Pay credit purchase');
    }
  }

  async processGooglePayPurchase(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id ? parseInt(req.user.id) : undefined;
      const { packageType, googlePayToken, promoCode } = req.body;
      const requestId = res.locals.requestId;

      if (!userId) {
        sendBadRequestError(res, 'User ID is required');
        return;
      }

      if (!packageType || !googlePayToken) {
        sendBadRequestError(res, 'Package type and Google Pay token are required');
        return;
      }

      const purchaseRequest: CreditPurchaseRequest = {
        packageType,
        promoCode
      };

      const purchaseResponse = await this.purchaseService.processGooglePayPurchase(
        userId,
        purchaseRequest,
        googlePayToken
      );

      logger.info('Google Pay credit purchase processed', {
        requestId,
        userId,
        purchaseId: purchaseResponse.purchaseId,
        packageType,
        totalCredits: purchaseResponse.totalCredits
      });

      sendSuccessResponse(res, 'Google Pay credit purchase processed successfully', {
        purchase: purchaseResponse
      });
    } catch (error) {
      const requestId = res.locals.requestId;
      logger.error('Failed to process Google Pay credit purchase', {
        requestId,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      sendInternalServerError(res, 'Failed to process Google Pay credit purchase');
    }
  }

  async getAvailablePackages(req: Request, res: Response): Promise<void> {
    try {
      const { userRole, includeDisabled = false } = req.query;
      const requestId = res.locals.requestId;

      const packages = Object.values(CreditPackageType).map(packageType => ({
        packageType,
        name: packageType.charAt(0).toUpperCase() + packageType.slice(1),
        enabled: true
      }));

      logger.info('Available credit packages retrieved', {
        requestId,
        userRole,
        packagesCount: packages.length
      });

      sendSuccessResponse(res, 'Available credit packages retrieved successfully', {
        packages
      });
    } catch (error) {
      const requestId = res.locals.requestId;
      logger.error('Failed to get available credit packages', {
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      sendInternalServerError(res, 'Failed to retrieve available credit packages');
    }
  }

  async validatePromoCode(req: Request, res: Response): Promise<void> {
    try {
      const { promoCode, packageType } = req.body;
      const userId = req.user?.id ? parseInt(req.user.id) : undefined;
      const requestId = res.locals.requestId;

      if (!promoCode || !packageType) {
        sendBadRequestError(res, 'Promo code and package type are required');
        return;
      }

      if (!userId) {
        sendBadRequestError(res, 'User ID is required');
        return;
      }

      const calculation = await this.purchaseService.calculatePurchase(packageType, promoCode);

      const isValid = calculation.discountAmount > 0;
      const discountPercentage = calculation.basePrice > 0 
        ? Math.round((calculation.discountAmount / calculation.basePrice) * 100) 
        : 0;

      logger.info('Promo code validated', {
        requestId,
        userId,
        promoCode,
        packageType,
        isValid,
        discountAmount: calculation.discountAmount
      });

      sendSuccessResponse(res, 'Promo code validated successfully', {
        valid: isValid,
        discountAmount: calculation.discountAmount,
        discountPercentage,
        finalAmount: calculation.finalAmount
      });
    } catch (error) {
      const requestId = res.locals.requestId;
      logger.error('Failed to validate promo code', {
        requestId,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      sendInternalServerError(res, 'Failed to validate promo code');
    }
  }
}
