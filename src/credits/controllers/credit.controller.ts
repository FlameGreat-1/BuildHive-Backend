import { Request, Response } from 'express';
import { CreditService, CreditNotificationService, AutoTopupService } from '../services';
import { 
  sendSuccessResponse,
  sendErrorResponse,
  sendNotFoundError,
  sendBadRequestError,
  sendInternalServerError
} from '../../shared/utils';
import { logger } from '../../shared/utils';
import { 
  CreditDashboard,
  CreditBalance,
  CreditLimits,
  AutoTopupSettings
} from '../types';
import { UserRole } from '../../shared/types';

export class CreditController {
  private creditService: CreditService;
  private notificationService: CreditNotificationService;
  private autoTopupService: AutoTopupService;

  constructor() {
    this.creditService = new CreditService();
    this.notificationService = new CreditNotificationService();
    this.autoTopupService = new AutoTopupService();
  }

  async getCreditBalance(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id ? parseInt(req.user.id) : undefined;
      const requestId = res.locals.requestId;

      if (!userId) {
        sendBadRequestError(res, 'User ID is required');
        return;
      }

      const balance = await this.creditService.getCreditBalance(userId);

      logger.info('Credit balance retrieved', {
        requestId,
        userId,
        balance: balance.currentBalance
      });

      sendSuccessResponse(res, 'Credit balance retrieved successfully', {
        balance: balance.toJSON()
      });
    } catch (error) {
      const requestId = res.locals.requestId;
      logger.error('Failed to get credit balance', {
        requestId,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      sendInternalServerError(res, 'Failed to retrieve credit balance');
    }
  }

  async getCreditDashboard(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id ? parseInt(req.user.id) : undefined;
      const requestId = res.locals.requestId;

      if (!userId) {
        sendBadRequestError(res, 'User ID is required');
        return;
      }

      const dashboard = await this.creditService.getCreditDashboard(userId);

      logger.info('Credit dashboard retrieved', {
        requestId,
        userId,
        currentBalance: dashboard.currentBalance
      });

      sendSuccessResponse(res, 'Credit dashboard retrieved successfully', {
        dashboard
      });
    } catch (error) {
      const requestId = res.locals.requestId;
      logger.error('Failed to get credit dashboard', {
        requestId,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      sendInternalServerError(res, 'Failed to retrieve credit dashboard');
    }
  }

  async getCreditLimits(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id ? parseInt(req.user.id) : undefined;
      const requestId = res.locals.requestId;

      if (!userId) {
        sendBadRequestError(res, 'User ID is required');
        return;
      }

      const limits = await this.creditService.getCreditLimits(userId);

      logger.info('Credit limits retrieved', {
        requestId,
        userId,
        maxCreditBalance: limits.maxCreditBalance
      });

      sendSuccessResponse(res, 'Credit limits retrieved successfully', {
        limits
      });
    } catch (error) {
      const requestId = res.locals.requestId;
      logger.error('Failed to get credit limits', {
        requestId,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      sendInternalServerError(res, 'Failed to retrieve credit limits');
    }
  }

  async checkCreditSufficiency(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id ? parseInt(req.user.id) : undefined;
      const { requiredCredits } = req.body;
      const requestId = res.locals.requestId;

      if (!userId) {
        sendBadRequestError(res, 'User ID is required');
        return;
      }

      if (!requiredCredits || requiredCredits <= 0) {
        sendBadRequestError(res, 'Valid required credits amount is needed');
        return;
      }

      const balanceCheck = await this.creditService.checkCreditSufficiency(userId, requiredCredits);

      logger.info('Credit sufficiency checked', {
        requestId,
        userId,
        requiredCredits,
        sufficient: balanceCheck.sufficient,
        shortfall: balanceCheck.shortfall
      });

      sendSuccessResponse(res, 'Credit sufficiency checked successfully', {
        balanceCheck
      });
    } catch (error) {
      const requestId = res.locals.requestId;
      logger.error('Failed to check credit sufficiency', {
        requestId,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      sendInternalServerError(res, 'Failed to check credit sufficiency');
    }
  }

  async getExpiringCredits(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id ? parseInt(req.user.id) : undefined;
      const { daysThreshold = 7 } = req.query;
      const requestId = res.locals.requestId;

      if (!userId) {
        sendBadRequestError(res, 'User ID is required');
        return;
      }

      const expiringCredits = await this.creditService.getExpiringCredits(
        userId,
        parseInt(daysThreshold as string)
      );

      logger.info('Expiring credits retrieved', {
        requestId,
        userId,
        daysThreshold,
        expiringCount: expiringCredits.length
      });

      sendSuccessResponse(res, 'Expiring credits retrieved successfully', {
        expiringCredits
      });
    } catch (error) {
      const requestId = res.locals.requestId;
      logger.error('Failed to get expiring credits', {
        requestId,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      sendInternalServerError(res, 'Failed to retrieve expiring credits');
    }
  }

  async setupAutoTopup(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id ? parseInt(req.user.id) : undefined;
      const { enabled, triggerBalance, topupAmount, packageType, paymentMethodId } = req.body;
      const requestId = res.locals.requestId;

      if (!userId) {
        sendBadRequestError(res, 'User ID is required');
        return;
      }

      const settings: AutoTopupSettings = {
        enabled,
        triggerBalance,
        topupAmount,
        packageType,
        paymentMethodId
      };

      const autoTopupSettings = await this.autoTopupService.setupAutoTopup(userId, settings);

      logger.info('Auto topup settings configured', {
        requestId,
        userId,
        enabled,
        triggerBalance,
        topupAmount,
        packageType
      });

      sendSuccessResponse(res, 'Auto topup settings configured successfully', {
        settings: autoTopupSettings.toJSON()
      });
    } catch (error) {
      const requestId = res.locals.requestId;
      logger.error('Failed to setup auto topup', {
        requestId,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      sendInternalServerError(res, 'Failed to configure auto topup settings');
    }
  }

  async getAutoTopupSettings(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id ? parseInt(req.user.id) : undefined;
      const requestId = res.locals.requestId;

      if (!userId) {
        sendBadRequestError(res, 'User ID is required');
        return;
      }

      const settings = await this.autoTopupService.getAutoTopupSettings(userId);

      if (!settings) {
        sendNotFoundError(res, 'Auto topup settings not found');
        return;
      }

      logger.info('Auto topup settings retrieved', {
        requestId,
        userId,
        enabled: settings.isEnabled()
      });

      sendSuccessResponse(res, 'Auto topup settings retrieved successfully', {
        settings: settings.toJSON()
      });
    } catch (error) {
      const requestId = res.locals.requestId;
      logger.error('Failed to get auto topup settings', {
        requestId,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      sendInternalServerError(res, 'Failed to retrieve auto topup settings');
    }
  }

  async enableAutoTopup(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id ? parseInt(req.user.id) : undefined;
      const requestId = res.locals.requestId;

      if (!userId) {
        sendBadRequestError(res, 'User ID is required');
        return;
      }

      const settings = await this.autoTopupService.enableAutoTopup(userId);

      logger.info('Auto topup enabled', {
        requestId,
        userId
      });

      sendSuccessResponse(res, 'Auto topup enabled successfully', {
        settings: settings.toJSON()
      });
    } catch (error) {
      const requestId = res.locals.requestId;
      logger.error('Failed to enable auto topup', {
        requestId,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      sendInternalServerError(res, 'Failed to enable auto topup');
    }
  }

  async disableAutoTopup(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id ? parseInt(req.user.id) : undefined;
      const requestId = res.locals.requestId;

      if (!userId) {
        sendBadRequestError(res, 'User ID is required');
        return;
      }

      const settings = await this.autoTopupService.disableAutoTopup(userId);

      logger.info('Auto topup disabled', {
        requestId,
        userId
      });

      sendSuccessResponse(res, 'Auto topup disabled successfully', {
        settings: settings.toJSON()
      });
    } catch (error) {
      const requestId = res.locals.requestId;
      logger.error('Failed to disable auto topup', {
        requestId,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      sendInternalServerError(res, 'Failed to disable auto topup');
    }
  }

  async updateAutoTopupPaymentMethod(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id ? parseInt(req.user.id) : undefined;
      const { paymentMethodId } = req.body;
      const requestId = res.locals.requestId;

      if (!userId) {
        sendBadRequestError(res, 'User ID is required');
        return;
      }

      if (!paymentMethodId) {
        sendBadRequestError(res, 'Payment method ID is required');
        return;
      }

      const settings = await this.autoTopupService.updatePaymentMethod(userId, paymentMethodId);

      logger.info('Auto topup payment method updated', {
        requestId,
        userId,
        paymentMethodId
      });

      sendSuccessResponse(res, 'Auto topup payment method updated successfully', {
        settings: settings.toJSON()
      });
    } catch (error) {
      const requestId = res.locals.requestId;
      logger.error('Failed to update auto topup payment method', {
        requestId,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      sendInternalServerError(res, 'Failed to update auto topup payment method');
    }
  }

  async getAutoTopupHistory(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id ? parseInt(req.user.id) : undefined;
      const { limit = 10 } = req.query;
      const requestId = res.locals.requestId;

      if (!userId) {
        sendBadRequestError(res, 'User ID is required');
        return;
      }

      const history = await this.autoTopupService.getAutoTopupHistory(
        userId,
        parseInt(limit as string)
      );

      logger.info('Auto topup history retrieved', {
        requestId,
        userId,
        historyCount: history.length
      });

      sendSuccessResponse(res, 'Auto topup history retrieved successfully', {
        history
      });
    } catch (error) {
      const requestId = res.locals.requestId;
      logger.error('Failed to get auto topup history', {
        requestId,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      sendInternalServerError(res, 'Failed to retrieve auto topup history');
    }
  }

  async validateCreditOperation(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id ? parseInt(req.user.id) : undefined;
      const { operation, amount } = req.body;
      const requestId = res.locals.requestId;

      if (!userId) {
        sendBadRequestError(res, 'User ID is required');
        return;
      }

      if (!operation || !amount) {
        sendBadRequestError(res, 'Operation and amount are required');
        return;
      }

      const validation = await this.creditService.validateCreditOperation(userId, operation, amount);

      logger.info('Credit operation validated', {
        requestId,
        userId,
        operation,
        amount,
        valid: validation.valid
      });

      sendSuccessResponse(res, 'Credit operation validated successfully', {
        validation
      });
    } catch (error) {
      const requestId = res.locals.requestId;
      logger.error('Failed to validate credit operation', {
        requestId,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      sendInternalServerError(res, 'Failed to validate credit operation');
    }
  }

  async awardTrialCredits(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id ? parseInt(req.user.id) : undefined;
      const requestId = res.locals.requestId;

      if (!userId) {
        sendBadRequestError(res, 'User ID is required');
        return;
      }

      const balance = await this.creditService.awardTrialCredits(userId);

      logger.info('Trial credits awarded', {
        requestId,
        userId,
        newBalance: balance.currentBalance
      });

      sendSuccessResponse(res, 'Trial credits awarded successfully', {
        balance: balance.toJSON()
      });
    } catch (error) {
      const requestId = res.locals.requestId;
      logger.error('Failed to award trial credits', {
        requestId,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      sendInternalServerError(res, 'Failed to award trial credits');
    }
  }
}
