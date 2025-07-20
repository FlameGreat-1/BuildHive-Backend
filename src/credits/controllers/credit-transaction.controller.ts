import { Request, Response } from 'express';
import { CreditTransactionService } from '../services';
import { 
  sendSuccessResponse,
  sendErrorResponse,
  sendNotFoundError,
  sendBadRequestError,
  sendInternalServerError
} from '../../shared/utils';
import { logger } from '../../shared/utils';
import { 
  CreditTransactionRequest,
  CreditTransactionFilter,
  CreditTransactionHistory
} from '../types';
import { CreditTransactionType, CreditUsageType } from '../../shared/types';

export class CreditTransactionController {
  private transactionService: CreditTransactionService;

  constructor() {
    this.transactionService = new CreditTransactionService();
  }

  async createTransaction(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id ? parseInt(req.user.id) : undefined;
      const { transactionType, credits, description, referenceId, referenceType, usageType, metadata } = req.body;
      const requestId = res.locals.requestId;

      if (!userId) {
        sendBadRequestError(res, 'User ID is required');
        return;
      }

      const transactionRequest: CreditTransactionRequest = {
        transactionType,
        credits,
        description,
        referenceId,
        referenceType,
        usageType,
        metadata
      };

      const transactionResponse = await this.transactionService.createTransaction(userId, transactionRequest);

      logger.info('Credit transaction created', {
        requestId,
        userId,
        transactionId: transactionResponse.transactionId,
        transactionType,
        credits,
        balanceAfter: transactionResponse.balanceAfter
      });

      sendSuccessResponse(res, 'Credit transaction created successfully', {
        transaction: transactionResponse
      });
    } catch (error) {
      const requestId = res.locals.requestId;
      logger.error('Failed to create credit transaction', {
        requestId,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      sendInternalServerError(res, 'Failed to create credit transaction');
    }
  }

  async processJobApplicationCredit(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id ? parseInt(req.user.id) : undefined;
      const { jobId, creditsRequired } = req.body;
      const requestId = res.locals.requestId;

      if (!userId) {
        sendBadRequestError(res, 'User ID is required');
        return;
      }

      if (!jobId || !creditsRequired) {
        sendBadRequestError(res, 'Job ID and credits required are needed');
        return;
      }

      const transactionResponse = await this.transactionService.processJobApplicationCredit(
        userId,
        jobId,
        creditsRequired
      );

      logger.info('Job application credit processed', {
        requestId,
        userId,
        jobId,
        creditsRequired,
        transactionId: transactionResponse.transactionId,
        balanceAfter: transactionResponse.balanceAfter
      });

      sendSuccessResponse(res, 'Job application credit processed successfully', {
        transaction: transactionResponse
      });
    } catch (error) {
      const requestId = res.locals.requestId;
      logger.error('Failed to process job application credit', {
        requestId,
        userId: req.user?.id,
        jobId: req.body.jobId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      sendInternalServerError(res, 'Failed to process job application credit');
    }
  }

  async processProfileBoostCredit(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id ? parseInt(req.user.id) : undefined;
      const { boostType, duration, creditsRequired } = req.body;
      const requestId = res.locals.requestId;

      if (!userId) {
        sendBadRequestError(res, 'User ID is required');
        return;
      }

      if (!boostType || !duration || !creditsRequired) {
        sendBadRequestError(res, 'Boost type, duration, and credits required are needed');
        return;
      }

      const transactionResponse = await this.transactionService.processProfileBoostCredit(
        userId,
        boostType,
        duration,
        creditsRequired
      );

      logger.info('Profile boost credit processed', {
        requestId,
        userId,
        boostType,
        duration,
        creditsRequired,
        transactionId: transactionResponse.transactionId,
        balanceAfter: transactionResponse.balanceAfter
      });

      sendSuccessResponse(res, 'Profile boost credit processed successfully', {
        transaction: transactionResponse
      });
    } catch (error) {
      const requestId = res.locals.requestId;
      logger.error('Failed to process profile boost credit', {
        requestId,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      sendInternalServerError(res, 'Failed to process profile boost credit');
    }
  }

  async processPremiumJobUnlock(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id ? parseInt(req.user.id) : undefined;
      const { jobId, creditsRequired } = req.body;
      const requestId = res.locals.requestId;

      if (!userId) {
        sendBadRequestError(res, 'User ID is required');
        return;
      }

      if (!jobId || !creditsRequired) {
        sendBadRequestError(res, 'Job ID and credits required are needed');
        return;
      }

      const transactionResponse = await this.transactionService.processPremiumJobUnlock(
        userId,
        jobId,
        creditsRequired
      );

      logger.info('Premium job unlock credit processed', {
        requestId,
        userId,
        jobId,
        creditsRequired,
        transactionId: transactionResponse.transactionId,
        balanceAfter: transactionResponse.balanceAfter
      });

      sendSuccessResponse(res, 'Premium job unlock credit processed successfully', {
        transaction: transactionResponse
      });
    } catch (error) {
      const requestId = res.locals.requestId;
      logger.error('Failed to process premium job unlock credit', {
        requestId,
        userId: req.user?.id,
        jobId: req.body.jobId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      sendInternalServerError(res, 'Failed to process premium job unlock credit');
    }
  }

  async getTransactionById(req: Request, res: Response): Promise<void> {
    try {
      const { transactionId } = req.params;
      const requestId = res.locals.requestId;

      if (!transactionId) {
        sendBadRequestError(res, 'Transaction ID is required');
        return;
      }

      const transaction = await this.transactionService.getTransactionById(parseInt(transactionId));

      if (!transaction) {
        sendNotFoundError(res, 'Transaction not found');
        return;
      }

      logger.info('Credit transaction retrieved', {
        requestId,
        transactionId: transaction.id,
        userId: transaction.userId
      });

      sendSuccessResponse(res, 'Credit transaction retrieved successfully', {
        transaction: transaction.toJSON()
      });
    } catch (error) {
      const requestId = res.locals.requestId;
      logger.error('Failed to get credit transaction', {
        requestId,
        transactionId: req.params.transactionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      sendInternalServerError(res, 'Failed to retrieve credit transaction');
    }
  }

  async getTransactionHistory(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id ? parseInt(req.user.id) : undefined;
      const { 
        page = 1,
        limit = 10,
        transactionType,
        status,
        dateFrom,
        dateTo,
        minCredits,
        maxCredits,
        referenceType,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;
      const requestId = res.locals.requestId;

      if (!userId) {
        sendBadRequestError(res, 'User ID is required');
        return;
      }

      const filter: CreditTransactionFilter = {
        userId: userId,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        transactionType: transactionType as CreditTransactionType,
        status: status as any,
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
        minCredits: minCredits ? parseInt(minCredits as string) : undefined,
        maxCredits: maxCredits ? parseInt(maxCredits as string) : undefined,
        referenceType: referenceType as string,
        sortBy: sortBy as any,
        sortOrder: sortOrder as 'asc' | 'desc'
      };

      const history = await this.transactionService.getTransactionHistory(userId, filter);

      logger.info('Credit transaction history retrieved', {
        requestId,
        userId,
        totalTransactions: history.totalTransactions,
        page,
        limit
      });

      sendSuccessResponse(res, 'Credit transaction history retrieved successfully', {
        history
      });
    } catch (error) {
      const requestId = res.locals.requestId;
      logger.error('Failed to get credit transaction history', {
        requestId,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      sendInternalServerError(res, 'Failed to retrieve credit transaction history');
    }
  }

  async getTransactionSummary(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id ? parseInt(req.user.id) : undefined;
      const { dateFrom, dateTo } = req.query;
      const requestId = res.locals.requestId;

      if (!userId) {
        sendBadRequestError(res, 'User ID is required');
        return;
      }

      const summary = await this.transactionService.getTransactionSummary(
        userId,
        dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo ? new Date(dateTo as string) : undefined
      );

      logger.info('Credit transaction summary retrieved', {
        requestId,
        userId,
        totalTransactions: summary.totalTransactions,
        totalCreditsIn: summary.totalCreditsIn,
        totalCreditsOut: summary.totalCreditsOut
      });

      sendSuccessResponse(res, 'Credit transaction summary retrieved successfully', {
        summary
      });
    } catch (error) {
      const requestId = res.locals.requestId;
      logger.error('Failed to get credit transaction summary', {
        requestId,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      sendInternalServerError(res, 'Failed to retrieve credit transaction summary');
    }
  }

  async cancelTransaction(req: Request, res: Response): Promise<void> {
    try {
      const { transactionId } = req.params;
      const { reason } = req.body;
      const requestId = res.locals.requestId;

      if (!transactionId) {
        sendBadRequestError(res, 'Transaction ID is required');
        return;
      }

      if (!reason) {
        sendBadRequestError(res, 'Cancellation reason is required');
        return;
      }

      const cancelledTransaction = await this.transactionService.cancelTransaction(
        parseInt(transactionId),
        reason
      );

      logger.info('Credit transaction cancelled', {
        requestId,
        transactionId: cancelledTransaction.id,
        userId: cancelledTransaction.userId,
        reason
      });

      sendSuccessResponse(res, 'Credit transaction cancelled successfully', {
        transaction: cancelledTransaction.toJSON()
      });
    } catch (error) {
      const requestId = res.locals.requestId;
      logger.error('Failed to cancel credit transaction', {
        requestId,
        transactionId: req.params.transactionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      sendInternalServerError(res, 'Failed to cancel credit transaction');
    }
  }

  async refundTransaction(req: Request, res: Response): Promise<void> {
    try {
      const { transactionId } = req.params;
      const { refundAmount, reason } = req.body;
      const requestId = res.locals.requestId;

      if (!transactionId) {
        sendBadRequestError(res, 'Transaction ID is required');
        return;
      }

      if (!refundAmount || !reason) {
        sendBadRequestError(res, 'Refund amount and reason are required');
        return;
      }

      const refundResponse = await this.transactionService.refundTransaction(
        parseInt(transactionId),
        refundAmount,
        reason
      );

      logger.info('Credit transaction refunded', {
        requestId,
        originalTransactionId: transactionId,
        refundTransactionId: refundResponse.transactionId,
        refundAmount,
        reason
      });

      sendSuccessResponse(res, 'Credit transaction refunded successfully', {
        refund: refundResponse
      });
    } catch (error) {
      const requestId = res.locals.requestId;
      logger.error('Failed to refund credit transaction', {
        requestId,
        transactionId: req.params.transactionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      sendInternalServerError(res, 'Failed to refund credit transaction');
    }
  }

  async validateTransactionRequest(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id ? parseInt(req.user.id) : undefined;
      const { transactionType, credits, description, usageType } = req.body;
      const requestId = res.locals.requestId;

      if (!userId) {
        sendBadRequestError(res, 'User ID is required');
        return;
      }

      const transactionRequest: CreditTransactionRequest = {
        transactionType,
        credits,
        description,
        usageType
      };

      const validation = await this.transactionService.validateTransactionRequest(userId, transactionRequest);

      logger.info('Credit transaction request validated', {
        requestId,
        userId,
        transactionType,
        credits,
        valid: validation.success
      });

      sendSuccessResponse(res, 'Credit transaction request validated successfully', {
        validation
      });
    } catch (error) {
      const requestId = res.locals.requestId;
      logger.error('Failed to validate credit transaction request', {
        requestId,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      sendInternalServerError(res, 'Failed to validate credit transaction request');
    }
  }
}
