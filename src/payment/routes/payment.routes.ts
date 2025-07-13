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
  '/create',
  authenticatePaymentUser,
  validatePaymentIntentCreation,
  validateCurrencySupport,
  validatePaymentLimits,
  paymentController.createPayment.bind(paymentController)
);

router.post(
  '/intent',
  authenticatePaymentUser,
  validatePaymentIntentCreation,
  validateCurrencySupport,
  validatePaymentLimits,
  paymentController.createPaymentIntent.bind(paymentController)
);

router.post(
  '/confirm/:paymentId',
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
  authenticatePaymentUser,
  paymentController.getPaymentMethods.bind(paymentController)
);

router.get(
  '/history',
  authenticatePaymentUser,
  paymentController.getPaymentHistory.bind(paymentController)
);

router.get(
  '/list',
  authenticatePaymentUser,
  paymentController.listPayments.bind(paymentController)
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

router.get(
  '/:paymentId',
  authenticatePaymentUser,
  authorizePaymentAccess,
  paymentController.getPaymentStatus.bind(paymentController)
);

export { router as paymentRoutes };
