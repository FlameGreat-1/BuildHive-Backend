import { Router } from 'express';
import { CreditPurchaseController } from '../controllers';
import { 
  authenticateCreditAccess,
  validateCreditPurchaseAccess,
  validateCreditOwnership
} from '../middleware';
import { 
  handleValidationErrors,
  validatePurchaseLimits
} from '../middleware';
import { 
  validateCreditPurchaseRequest,
  validateCreditPurchaseId,
  validateCreditPurchaseHistory,
  validateCreditRefundRequest,
  validatePromoCodeRequest,
  validateCreditPackageQuery
} from '../validators';
import { rateLimit } from '../../shared/middleware';

const router = Router();
const purchaseController = new CreditPurchaseController();

router.post(
  '/initiate',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Too many purchase attempts, please try again later'
  }),
  authenticateCreditAccess,
  validateCreditPurchaseAccess,
  validateCreditPurchaseRequest(),
  handleValidationErrors,
  validatePurchaseLimits,
  purchaseController.initiatePurchase.bind(purchaseController)
);

router.post(
  '/:purchaseId/complete',
  authenticateCreditAccess,
  validateCreditPurchaseAccess,
  validateCreditPurchaseId(),
  handleValidationErrors,
  purchaseController.completePurchase.bind(purchaseController)
);

router.post(
  '/:purchaseId/cancel',
  authenticateCreditAccess,
  validateCreditOwnership,
  validateCreditPurchaseId(),
  handleValidationErrors,
  purchaseController.cancelPurchase.bind(purchaseController)
);

router.post(
  '/:purchaseId/refund',
  authenticateCreditAccess,
  validateCreditOwnership,
  validateCreditPurchaseId(),
  validateCreditRefundRequest(),
  handleValidationErrors,
  purchaseController.refundPurchase.bind(purchaseController)
);

router.get(
  '/:purchaseId',
  authenticateCreditAccess,
  validateCreditOwnership,
  validateCreditPurchaseId(),
  handleValidationErrors,
  purchaseController.getPurchaseById.bind(purchaseController)
);

router.get(
  '/history',
  authenticateCreditAccess,
  validateCreditOwnership,
  validateCreditPurchaseHistory(),
  handleValidationErrors,
  purchaseController.getPurchaseHistory.bind(purchaseController)
);

router.post(
  '/calculate',
  authenticateCreditAccess,
  validateCreditPurchaseAccess,
  handleValidationErrors,
  purchaseController.calculatePurchase.bind(purchaseController)
);

router.get(
  '/:purchaseId/receipt',
  authenticateCreditAccess,
  validateCreditOwnership,
  validateCreditPurchaseId(),
  handleValidationErrors,
  purchaseController.generateReceipt.bind(purchaseController)
);

router.post(
  '/apple-pay',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many Apple Pay attempts, please try again later'
  }),
  authenticateCreditAccess,
  validateCreditPurchaseAccess,
  handleValidationErrors,
  validatePurchaseLimits,
  purchaseController.processApplePayPurchase.bind(purchaseController)
);

router.post(
  '/google-pay',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many Google Pay attempts, please try again later'
  }),
  authenticateCreditAccess,
  validateCreditPurchaseAccess,
  handleValidationErrors,
  validatePurchaseLimits,
  purchaseController.processGooglePayPurchase.bind(purchaseController)
);

router.get(
  '/packages/available',
  authenticateCreditAccess,
  validateCreditPackageQuery(),
  handleValidationErrors,
  purchaseController.getAvailablePackages.bind(purchaseController)
);

router.post(
  '/promo-code/validate',
  authenticateCreditAccess,
  validateCreditPurchaseAccess,
  validatePromoCodeRequest(),
  handleValidationErrors,
  purchaseController.validatePromoCode.bind(purchaseController)
);

export { router as creditPurchaseRoutes };
