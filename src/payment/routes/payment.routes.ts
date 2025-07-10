import { Router } from 'express';
import { PaymentController } from '../controllers';
import { 
  authenticatePaymentUser,
  authorizePaymentAccess,
  validatePaymentLimits
} from '../middleware/payment-auth.middleware';
import {
  validatePaymentIntentCreation,
  validatePaymentConfirmation,
  validatePaymentLinkCreation,
  validateCurrencySupport
} from '../middleware/payment-validation.middleware';

const router = Router();
const paymentController = new PaymentController();

router.post(
  '/intent',
  authenticatePaymentUser,
  validatePaymentIntentCreation,
  validateCurrencySupport,
  validatePaymentLimits,
  paymentController.createPaymentIntent.bind(paymentController)
);

router.post(
  '/confirm',
  authenticatePaymentUser,
  authorizePaymentAccess,
  validatePaymentConfirmation,
  paymentController.confirmPayment.bind(paymentController)
);

router.post(
  '/links',
  authenticatePaymentUser,
  validatePaymentLinkCreation,
  validateCurrencySupport,
  validatePaymentLimits,
  paymentController.createPaymentLink.bind(paymentController)
);

router.get(
  '/methods',
  paymentController.getPaymentMethods.bind(paymentController)
);

router.get(
  '/history',
  authenticatePaymentUser,
  paymentController.getPaymentHistory.bind(paymentController)
);

router.get(
  '/:paymentId/status',
  authenticatePaymentUser,
  authorizePaymentAccess,
  paymentController.getPaymentStatus.bind(paymentController)
);

router.post(
  '/:paymentId/cancel',
  authenticatePaymentUser,
  authorizePaymentAccess,
  paymentController.cancelPayment.bind(paymentController)
);

export { router as paymentRoutes };
