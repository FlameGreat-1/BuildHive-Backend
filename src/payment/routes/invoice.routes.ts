import { Router } from 'express';
import { InvoiceController } from '../controllers';
import { 
  authenticatePaymentUser,
  authorizePaymentAccess,
  validatePaymentLimits
} from '../middleware/payment-auth.middleware';
import {
  validateInvoiceCreation,
  validateInvoiceStatusUpdate,
  validateInvoiceAccess,
  validateCurrencySupport
} from '../middleware/payment-validation.middleware';

const router = Router();
const invoiceController = new InvoiceController();

router.post(
  '/',
  authenticatePaymentUser,
  validateInvoiceCreation,
  validateCurrencySupport,
  validatePaymentLimits,
  invoiceController.createInvoice.bind(invoiceController)
);

router.get(
  '/',
  authenticatePaymentUser,
  invoiceController.getUserInvoices.bind(invoiceController)
);

router.get(
  '/:invoiceId',
  authenticatePaymentUser,
  authorizePaymentAccess,
  validateInvoiceAccess,
  invoiceController.getInvoice.bind(invoiceController)
);

router.patch(
  '/:invoiceId/status',
  authenticatePaymentUser,
  authorizePaymentAccess,
  validateInvoiceAccess,
  validateInvoiceStatusUpdate,
  invoiceController.updateInvoiceStatus.bind(invoiceController)
);

router.post(
  '/:invoiceId/send',
  authenticatePaymentUser,
  authorizePaymentAccess,
  validateInvoiceAccess,
  invoiceController.sendInvoice.bind(invoiceController)
);

router.post(
  '/:invoiceId/cancel',
  authenticatePaymentUser,
  authorizePaymentAccess,
  validateInvoiceAccess,
  invoiceController.cancelInvoice.bind(invoiceController)
);

router.delete(
  '/:invoiceId',
  authenticatePaymentUser,
  authorizePaymentAccess,
  validateInvoiceAccess,
  invoiceController.deleteInvoice.bind(invoiceController)
);

export { router as invoiceRoutes };
