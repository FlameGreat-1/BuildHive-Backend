import { Router } from 'express';
import { CreditController } from '../controllers';
import { 
  authenticateCreditAccess,
  validateCreditOwnership,
  validateAutoTopupAccess
} from '../middleware';
import { 
  handleValidationErrors,
  validateSufficientBalance,
  validateAutoTopupConfiguration
} from '../middleware';
import { rateLimit } from '../../shared/middleware';

const router = Router();
const creditController = new CreditController();

router.get(
  '/balance',
  authenticateCreditAccess,
  validateCreditOwnership,
  creditController.getCreditBalance.bind(creditController)
);

router.get(
  '/dashboard',
  authenticateCreditAccess,
  validateCreditOwnership,
  creditController.getCreditDashboard.bind(creditController)
);

router.get(
  '/limits',
  authenticateCreditAccess,
  validateCreditOwnership,
  creditController.getCreditLimits.bind(creditController)
);

router.post(
  '/check-sufficiency',
  authenticateCreditAccess,
  validateCreditOwnership,
  handleValidationErrors,
  creditController.checkCreditSufficiency.bind(creditController)
);

router.get(
  '/expiring',
  authenticateCreditAccess,
  validateCreditOwnership,
  creditController.getExpiringCredits.bind(creditController)
);

router.post(
  '/auto-topup/setup',
  authenticateCreditAccess,
  validateAutoTopupAccess,
  validateAutoTopupConfiguration,
  handleValidationErrors,
  creditController.setupAutoTopup.bind(creditController)
);

router.get(
  '/auto-topup/settings',
  authenticateCreditAccess,
  validateAutoTopupAccess,
  creditController.getAutoTopupSettings.bind(creditController)
);

router.put(
  '/auto-topup/enable',
  authenticateCreditAccess,
  validateAutoTopupAccess,
  creditController.enableAutoTopup.bind(creditController)
);

router.put(
  '/auto-topup/disable',
  authenticateCreditAccess,
  validateAutoTopupAccess,
  creditController.disableAutoTopup.bind(creditController)
);

router.put(
  '/auto-topup/payment-method',
  authenticateCreditAccess,
  validateAutoTopupAccess,
  handleValidationErrors,
  creditController.updateAutoTopupPaymentMethod.bind(creditController)
);

router.get(
  '/auto-topup/history',
  authenticateCreditAccess,
  validateAutoTopupAccess,
  creditController.getAutoTopupHistory.bind(creditController)
);

router.post(
  '/validate-operation',
  authenticateCreditAccess,
  validateCreditOwnership,
  handleValidationErrors,
  creditController.validateCreditOperation.bind(creditController)
);

router.post(
  '/award-trial',
  rateLimit({
    windowMs: 24 * 60 * 60 * 1000,
    max: 1,
    message: 'Trial credits can only be awarded once per day'
  }),
  authenticateCreditAccess,
  creditController.awardTrialCredits.bind(creditController)
);

export { router as creditRoutes };
