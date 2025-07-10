import { Router } from 'express';
import { RefundController } from '../controllers';
import { 
  authenticatePaymentUser,
  authorizePaymentAccess,
  validatePaymentLimits
} from '../middleware/payment-auth.middleware';
import {
  validateRefundCreation,
  validateRefundStatusUpdate,
  validateRefundAccess,
  validateRefundAmount
} from '../middleware/payment-validation.middleware';

const router = Router();
const refundController = new RefundController();

router.post(
  '/',
  authenticatePaymentUser,
  validateRefundCreation,
  validateRefundAmount,
  validatePaymentLimits,
  refundController.createRefund.bind(refundController)
);

router.get(
  '/',
  authenticatePaymentUser,
  refundController.getUserRefunds.bind(refundController)
);

router.get(
  '/:refundId',
  authenticatePaymentUser,
  authorizePaymentAccess,
  validateRefundAccess,
  refundController.getRefund.bind(refundController)
);

router.get(
  '/payment/:paymentId',
  authenticatePaymentUser,
  authorizePaymentAccess,
  refundController.getPaymentRefunds.bind(refundController)
);

router.patch(
  '/:refundId/status',
  authenticatePaymentUser,
  authorizePaymentAccess,
  validateRefundAccess,
  validateRefundStatusUpdate,
  refundController.updateRefundStatus.bind(refundController)
);

router.post(
  '/:refundId/cancel',
  authenticatePaymentUser,
  authorizePaymentAccess,
  validateRefundAccess,
  refundController.cancelRefund.bind(refundController)
);

export { router as refundRoutes };
