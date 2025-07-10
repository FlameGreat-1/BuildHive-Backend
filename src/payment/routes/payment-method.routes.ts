import { Router } from 'express';
import { PaymentMethodController } from '../controllers';
import { 
  authenticatePaymentUser,
  authorizePaymentAccess,
  validatePaymentLimits
} from '../middleware/payment-auth.middleware';
import {
  validatePaymentMethodCreation,
  validatePaymentMethodAttachment,
  validatePaymentMethodDetachment,
  validateDefaultPaymentMethodSetting
} from '../middleware/payment-validation.middleware';

const router = Router();
const paymentMethodController = new PaymentMethodController();

router.post(
  '/',
  authenticatePaymentUser,
  validatePaymentMethodCreation,
  paymentMethodController.createPaymentMethod.bind(paymentMethodController)
);

router.post(
  '/attach',
  authenticatePaymentUser,
  validatePaymentMethodAttachment,
  paymentMethodController.attachPaymentMethod.bind(paymentMethodController)
);

router.post(
  '/:paymentMethodId/detach',
  authenticatePaymentUser,
  authorizePaymentAccess,
  validatePaymentMethodDetachment,
  paymentMethodController.detachPaymentMethod.bind(paymentMethodController)
);

router.post(
  '/:paymentMethodId/set-default',
  authenticatePaymentUser,
  authorizePaymentAccess,
  validateDefaultPaymentMethodSetting,
  paymentMethodController.setDefaultPaymentMethod.bind(paymentMethodController)
);

router.get(
  '/',
  authenticatePaymentUser,
  paymentMethodController.getUserPaymentMethods.bind(paymentMethodController)
);

router.get(
  '/default',
  authenticatePaymentUser,
  paymentMethodController.getDefaultPaymentMethod.bind(paymentMethodController)
);

router.delete(
  '/:paymentMethodId',
  authenticatePaymentUser,
  authorizePaymentAccess,
  paymentMethodController.deletePaymentMethod.bind(paymentMethodController)
);

export { router as paymentMethodRoutes };
