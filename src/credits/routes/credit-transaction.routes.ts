import { Router } from 'express';
import { CreditTransactionController } from '../controllers';
import { 
  authenticateCreditAccess,
  validateCreditUsageAccess,
  validateCreditOwnership
} from '../middleware';
import { 
  handleValidationErrors,
  validateSufficientBalance,
  validateUsageLimits,
  validateTransactionLimits
} from '../middleware';
import { 
  validateCreditTransactionRequest,
  validateTransactionId,
  validateTransactionHistory,
  validateTransactionSummary,
  validateJobApplicationCredit,
  validateProfileBoostCredit,
  validatePremiumJobUnlock
} from '../validators';
import { rateLimit } from '../../shared/middleware';

const router = Router();
const transactionController = new CreditTransactionController();

router.post(
  '/create',
  rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    message: 'Too many transaction attempts, please try again later'
  }),
  authenticateCreditAccess,
  validateCreditOwnership,
  validateCreditTransactionRequest(),
  handleValidationErrors,
  validateTransactionLimits,
  transactionController.createTransaction.bind(transactionController)
);

router.post(
  '/job-application',
  rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    message: 'Too many job application attempts, please try again later'
  }),
  authenticateCreditAccess,
  validateCreditUsageAccess,
  validateJobApplicationCredit(),
  handleValidationErrors,
  validateSufficientBalance,
  validateUsageLimits,
  transactionController.processJobApplicationCredit.bind(transactionController)
);

router.post(
  '/profile-boost',
  rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: 'Too many profile boost attempts, please try again later'
  }),
  authenticateCreditAccess,
  validateCreditUsageAccess,
  validateProfileBoostCredit(),
  handleValidationErrors,
  validateSufficientBalance,
  validateUsageLimits,
  transactionController.processProfileBoostCredit.bind(transactionController)
);

router.post(
  '/premium-job-unlock',
  rateLimit({
    windowMs: 60 * 1000,
    max: 15,
    message: 'Too many premium job unlock attempts, please try again later'
  }),
  authenticateCreditAccess,
  validateCreditUsageAccess,
  validatePremiumJobUnlock(),
  handleValidationErrors,
  validateSufficientBalance,
  validateUsageLimits,
  transactionController.processPremiumJobUnlock.bind(transactionController)
);

router.get(
  '/:transactionId',
  authenticateCreditAccess,
  validateCreditOwnership,
  validateTransactionId(),
  handleValidationErrors,
  transactionController.getTransactionById.bind(transactionController)
);

router.get(
  '/history',
  authenticateCreditAccess,
  validateCreditOwnership,
  validateTransactionHistory(),
  handleValidationErrors,
  transactionController.getTransactionHistory.bind(transactionController)
);

router.get(
  '/summary',
  authenticateCreditAccess,
  validateCreditOwnership,
  validateTransactionSummary(),
  handleValidationErrors,
  transactionController.getTransactionSummary.bind(transactionController)
);

router.post(
  '/:transactionId/cancel',
  authenticateCreditAccess,
  validateCreditOwnership,
  validateTransactionId(),
  handleValidationErrors,
  transactionController.cancelTransaction.bind(transactionController)
);

router.post(
  '/:transactionId/refund',
  authenticateCreditAccess,
  validateCreditOwnership,
  validateTransactionId(),
  handleValidationErrors,
  transactionController.refundTransaction.bind(transactionController)
);

router.post(
  '/validate-request',
  authenticateCreditAccess,
  validateCreditOwnership,
  validateCreditTransactionRequest(),
  handleValidationErrors,
  transactionController.validateTransactionRequest.bind(transactionController)
);

export { router as creditTransactionRoutes };
