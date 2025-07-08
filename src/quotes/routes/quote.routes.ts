import { Router } from 'express';
import { QuoteController } from '../controllers';
import { JobService } from '../../jobs/services';
import { UserService } from '../../auth/services';
import { authMiddleware } from '../../auth/middleware';
import { 
  validateCreateQuote,
  validateUpdateQuote,
  validateQuoteStatusUpdate,
  validateQuoteDelivery,
  validateAIPricingRequest,
  validateQuoteId,
  validateQuoteNumber,
  validatePaymentMethod,
  validateRefundRequest,
  validateInvoiceRequest,
  validatePaymentWebhook
} from '../middleware';
import { 
  createQuoteSchema,
  updateQuoteSchema,
  quoteStatusUpdateSchema,
  quoteDeliverySchema,
  aiPricingRequestSchema,
  quoteFilterSchema,
  paymentMethodSchema,
  refundRequestSchema,
  invoiceRequestSchema,
  paymentWebhookSchema
} from '../validators';
import { rateLimitMiddleware } from '../../shared/middleware';
import { errorMiddleware } from '../../shared/middleware';
import { loggingMiddleware } from '../../shared/middleware';
import { QUOTE_RATE_LIMITS } from '../../config/quotes';

const router = Router();

const jobService = new JobService();
const userService = new UserService();
const quoteController = new QuoteController(jobService, userService);

router.use(loggingMiddleware);

router.post(
  '/',
  authMiddleware,
  rateLimitMiddleware(QUOTE_RATE_LIMITS.CREATION),
  validateCreateQuote,
  async (req, res, next) => {
    await quoteController.createQuote(req, res, next);
  }
);

router.get(
  '/',
  authMiddleware,
  rateLimitMiddleware(QUOTE_RATE_LIMITS.VIEW),
  async (req, res, next) => {
    await quoteController.getQuotes(req, res, next);
  }
);

router.get(
  '/analytics',
  authMiddleware,
  rateLimitMiddleware(QUOTE_RATE_LIMITS.OPERATIONS),
  async (req, res, next) => {
    await quoteController.getAnalytics(req, res, next);
  }
);

router.get(
  '/generate-number',
  authMiddleware,
  rateLimitMiddleware(QUOTE_RATE_LIMITS.OPERATIONS),
  async (req, res, next) => {
    await quoteController.generateQuoteNumber(req, res, next);
  }
);

router.post(
  '/calculate',
  authMiddleware,
  rateLimitMiddleware(QUOTE_RATE_LIMITS.OPERATIONS),
  async (req, res, next) => {
    await quoteController.calculateQuote(req, res, next);
  }
);

router.post(
  '/calculate-with-fees',
  authMiddleware,
  rateLimitMiddleware(QUOTE_RATE_LIMITS.OPERATIONS),
  async (req, res, next) => {
    await quoteController.calculateQuoteWithFees(req, res, next);
  }
);

router.post(
  '/ai-pricing',
  authMiddleware,
  rateLimitMiddleware(QUOTE_RATE_LIMITS.AI_PRICING),
  validateAIPricingRequest,
  async (req, res, next) => {
    await quoteController.getAIPricing(req, res, next);
  }
);

router.get(
  '/client',
  authMiddleware,
  rateLimitMiddleware(QUOTE_RATE_LIMITS.VIEW),
  async (req, res, next) => {
    await quoteController.getClientQuotes(req, res, next);
  }
);

router.post(
  '/payment-webhook',
  rateLimitMiddleware(QUOTE_RATE_LIMITS.WEBHOOK),
  validatePaymentWebhook,
  async (req, res, next) => {
    await quoteController.handlePaymentWebhook(req, res, next);
  }
);

router.get(
  '/number/:quoteNumber',
  validateQuoteNumber,
  rateLimitMiddleware(QUOTE_RATE_LIMITS.VIEW),
  async (req, res, next) => {
    await quoteController.getQuoteByNumber(req, res, next);
  }
);

router.get(
  '/view/:quoteNumber',
  validateQuoteNumber,
  rateLimitMiddleware(QUOTE_RATE_LIMITS.VIEW),
  async (req, res, next) => {
    await quoteController.viewQuote(req, res, next);
  }
);

router.post(
  '/accept/:quoteNumber',
  authMiddleware,
  validateQuoteNumber,
  rateLimitMiddleware(QUOTE_RATE_LIMITS.STATUS_CHANGE),
  async (req, res, next) => {
    await quoteController.acceptQuote(req, res, next);
  }
);

router.post(
  '/reject/:quoteNumber',
  authMiddleware,
  validateQuoteNumber,
  rateLimitMiddleware(QUOTE_RATE_LIMITS.STATUS_CHANGE),
  async (req, res, next) => {
    await quoteController.rejectQuote(req, res, next);
  }
);

router.post(
  '/:quoteNumber/payment-intent',
  authMiddleware,
  validateQuoteNumber,
  rateLimitMiddleware(QUOTE_RATE_LIMITS.PAYMENT),
  async (req, res, next) => {
    await quoteController.createPaymentIntent(req, res, next);
  }
);

router.post(
  '/:quoteNumber/accept-with-payment',
  authMiddleware,
  validateQuoteNumber,
  rateLimitMiddleware(QUOTE_RATE_LIMITS.PAYMENT),
  validatePaymentMethod,
  async (req, res, next) => {
    await quoteController.acceptQuoteWithPayment(req, res, next);
  }
);

router.get(
  '/:quoteNumber/payment-details',
  validateQuoteNumber,
  rateLimitMiddleware(QUOTE_RATE_LIMITS.VIEW),
  async (req, res, next) => {
    await quoteController.getQuoteWithPaymentDetails(req, res, next);
  }
);

router.get(
  '/:quoteId',
  authMiddleware,
  validateQuoteId,
  rateLimitMiddleware(QUOTE_RATE_LIMITS.VIEW),
  async (req, res, next) => {
    await quoteController.getQuote(req, res, next);
  }
);

router.put(
  '/:quoteId',
  authMiddleware,
  validateQuoteId,
  rateLimitMiddleware(QUOTE_RATE_LIMITS.UPDATE),
  validateUpdateQuote,
  async (req, res, next) => {
    await quoteController.updateQuote(req, res, next);
  }
);

router.patch(
  '/:quoteId/status',
  authMiddleware,
  validateQuoteId,
  rateLimitMiddleware(QUOTE_RATE_LIMITS.STATUS_CHANGE),
  validateQuoteStatusUpdate,
  async (req, res, next) => {
    await quoteController.updateQuoteStatus(req, res, next);
  }
);

router.delete(
  '/:quoteId',
  authMiddleware,
  validateQuoteId,
  rateLimitMiddleware(QUOTE_RATE_LIMITS.OPERATIONS),
  async (req, res, next) => {
    await quoteController.deleteQuote(req, res, next);
  }
);

router.post(
  '/:quoteId/send',
  authMiddleware,
  validateQuoteId,
  rateLimitMiddleware(QUOTE_RATE_LIMITS.DELIVERY),
  validateQuoteDelivery,
  async (req, res, next) => {
    await quoteController.sendQuote(req, res, next);
  }
);

router.post(
  '/:quoteId/duplicate',
  authMiddleware,
  validateQuoteId,
  rateLimitMiddleware(QUOTE_RATE_LIMITS.CREATION),
  async (req, res, next) => {
    await quoteController.duplicateQuote(req, res, next);
  }
);

router.post(
  '/:quoteId/process-payment',
  authMiddleware,
  validateQuoteId,
  rateLimitMiddleware(QUOTE_RATE_LIMITS.PAYMENT),
  validatePaymentMethod,
  async (req, res, next) => {
    await quoteController.processQuotePayment(req, res, next);
  }
);

router.post(
  '/:quoteId/refund',
  authMiddleware,
  validateQuoteId,
  rateLimitMiddleware(QUOTE_RATE_LIMITS.REFUND),
  validateRefundRequest,
  async (req, res, next) => {
    await quoteController.refundQuotePayment(req, res, next);
  }
);

router.post(
  '/:quoteId/invoice',
  authMiddleware,
  validateQuoteId,
  rateLimitMiddleware(QUOTE_RATE_LIMITS.OPERATIONS),
  validateInvoiceRequest,
  async (req, res, next) => {
    await quoteController.generateQuoteInvoice(req, res, next);
  }
);

router.get(
  '/:quoteId/payment-summary',
  authMiddleware,
  validateQuoteId,
  rateLimitMiddleware(QUOTE_RATE_LIMITS.VIEW),
  async (req, res, next) => {
    await quoteController.getQuotePaymentSummary(req, res, next);
  }
);

router.use(errorMiddleware);

export { router as quoteRoutes };
