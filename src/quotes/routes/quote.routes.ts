import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { QuoteController } from '../controllers';
import { JobService } from '../../jobs/services';
import { UserService } from '../../auth/services';
import { authenticate } from '../../auth/middleware';
import { 
  validateCreateQuote,
  validateUpdateQuote,
  validateQuoteStatusUpdate,
  validateQuoteDelivery,
  validateAIPricingRequest,
  validateQuoteId,
  validateQuoteNumber,
  validatePaymentMethodId,
  validateRefundRequest
} from '../middleware';
import { 
  createQuoteSchema,
  updateQuoteSchema,
  quoteStatusUpdateSchema,
  quoteDeliverySchema,
  aiPricingRequestSchema,
  quoteFilterSchema
} from '../validators';
import { errorHandler } from '../../shared/middleware';
import { requestLogger } from '../../shared/middleware';
import { QUOTE_RATE_LIMITS } from '../../config/quotes';

const router = Router();

// Rate limit helper function to convert QUOTE_RATE_LIMITS to express-rate-limit format
const createRateLimit = (config: { WINDOW_MS: number; MAX_ATTEMPTS: number }, message: string) => {
  return rateLimit({
    windowMs: config.WINDOW_MS,
    max: config.MAX_ATTEMPTS,
    message: {
      error: message,
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil(config.WINDOW_MS / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        error: message,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(config.WINDOW_MS / 1000)
      });
    }
  });
};

const jobService = new JobService();
const userService = new UserService();
const quoteController = new QuoteController(jobService, userService);

router.use(requestLogger);

router.post(
  '/',
  authenticate,
  createRateLimit(QUOTE_RATE_LIMITS.CREATION, 'Too many quote creation attempts'),
  validateCreateQuote,
  async (req, res, next) => {
    await quoteController.createQuote(req, res, next);
  }
);

router.get(
  '/',
  authenticate,
  createRateLimit(QUOTE_RATE_LIMITS.VIEW, 'Too many quote view requests'),
  async (req, res, next) => {
    await quoteController.getQuotes(req, res, next);
  }
);

router.get(
  '/analytics',
  authenticate,
  createRateLimit(QUOTE_RATE_LIMITS.OPERATIONS, 'Too many analytics requests'),
  async (req, res, next) => {
    await quoteController.getAnalytics(req, res, next);
  }
);

router.get(
  '/generate-number',
  authenticate,
  createRateLimit(QUOTE_RATE_LIMITS.OPERATIONS, 'Too many quote number generation requests'),
  async (req, res, next) => {
    await quoteController.generateQuoteNumber(req, res, next);
  }
);

router.post(
  '/calculate',
  authenticate,
  createRateLimit(QUOTE_RATE_LIMITS.OPERATIONS, 'Too many quote calculation requests'),
  async (req, res, next) => {
    await quoteController.calculateQuote(req, res, next);
  }
);

router.post(
  '/ai-pricing',
  authenticate,
  createRateLimit(QUOTE_RATE_LIMITS.AI_PRICING, 'Too many AI pricing requests'),
  validateAIPricingRequest,
  async (req, res, next) => {
    await quoteController.getAIPricing(req, res, next);
  }
);

router.get(
  '/client',
  authenticate,
  createRateLimit(QUOTE_RATE_LIMITS.VIEW, 'Too many client quote requests'),
  async (req, res, next) => {
    await quoteController.getClientQuotes(req, res, next);
  }
);

router.get(
  '/number/:quoteNumber',
  validateQuoteNumber,
  createRateLimit(QUOTE_RATE_LIMITS.VIEW, 'Too many quote number lookup requests'),
  async (req, res, next) => {
    await quoteController.getQuoteByNumber(req, res, next);
  }
);

router.get(
  '/view/:quoteNumber',
  validateQuoteNumber,
  createRateLimit(QUOTE_RATE_LIMITS.VIEW, 'Too many quote view requests'),
  async (req, res, next) => {
    await quoteController.viewQuote(req, res, next);
  }
);

router.post(
  '/accept/:quoteNumber',
  authenticate,
  validateQuoteNumber,
  createRateLimit(QUOTE_RATE_LIMITS.STATUS_CHANGE, 'Too many quote acceptance attempts'),
  async (req, res, next) => {
    await quoteController.acceptQuote(req, res, next);
  }
);

router.post(
  '/reject/:quoteNumber',
  authenticate,
  validateQuoteNumber,
  createRateLimit(QUOTE_RATE_LIMITS.STATUS_CHANGE, 'Too many quote rejection attempts'),
  async (req, res, next) => {
    await quoteController.rejectQuote(req, res, next);
  }
);

router.get(
  '/:quoteId',
  authenticate,
  validateQuoteId,
  createRateLimit(QUOTE_RATE_LIMITS.VIEW, 'Too many quote detail requests'),
  async (req, res, next) => {
    await quoteController.getQuote(req, res, next);
  }
);

router.put(
  '/:quoteId',
  authenticate,
  validateQuoteId,
  createRateLimit(QUOTE_RATE_LIMITS.UPDATE, 'Too many quote update attempts'),
  validateUpdateQuote,
  async (req, res, next) => {
    await quoteController.updateQuote(req, res, next);
  }
);

router.patch(
  '/:quoteId/status',
  authenticate,
  validateQuoteId,
  createRateLimit(QUOTE_RATE_LIMITS.STATUS_CHANGE, 'Too many status change attempts'),
  validateQuoteStatusUpdate,
  async (req, res, next) => {
    await quoteController.updateQuoteStatus(req, res, next);
  }
);

router.delete(
  '/:quoteId',
  authenticate,
  validateQuoteId,
  createRateLimit(QUOTE_RATE_LIMITS.OPERATIONS, 'Too many quote deletion attempts'),
  async (req, res, next) => {
    await quoteController.deleteQuote(req, res, next);
  }
);

router.post(
  '/:quoteId/send',
  authenticate,
  validateQuoteId,
  createRateLimit(QUOTE_RATE_LIMITS.DELIVERY, 'Too many quote delivery attempts'),
  validateQuoteDelivery,
  async (req, res, next) => {
    await quoteController.sendQuote(req, res, next);
  }
);

router.post(
  '/:quoteId/duplicate',
  authenticate,
  validateQuoteId,
  createRateLimit(QUOTE_RATE_LIMITS.CREATION, 'Too many quote duplication attempts'),
  async (req, res, next) => {
    await quoteController.duplicateQuote(req, res, next);
  }
);

router.post(
  '/:quoteNumber/accept-with-payment',
  authenticate,
  validateQuoteNumber,
  validatePaymentMethodId,
  createRateLimit(QUOTE_RATE_LIMITS.PAYMENT, 'Too many payment acceptance attempts'),
  async (req, res, next) => {
    await quoteController.acceptQuoteWithPayment(req, res, next);
  }
);

router.post(
  '/:quoteNumber/payment-intent',
  authenticate,
  validateQuoteNumber,
  createRateLimit(QUOTE_RATE_LIMITS.PAYMENT, 'Too many payment intent creation attempts'),
  async (req, res, next) => {
    await quoteController.createPaymentIntent(req, res, next);
  }
);

router.post(
  '/:quoteId/generate-invoice',
  authenticate,
  validateQuoteId,
  createRateLimit(QUOTE_RATE_LIMITS.OPERATIONS, 'Too many invoice generation attempts'),
  async (req, res, next) => {
    await quoteController.generateQuoteInvoice(req, res, next);
  }
);

router.post(
  '/:quoteId/refund',
  authenticate,
  validateQuoteId,
  validateRefundRequest,
  createRateLimit(QUOTE_RATE_LIMITS.OPERATIONS, 'Too many refund attempts'),
  async (req, res, next) => {
    await quoteController.refundQuotePayment(req, res, next);
  }
);

router.use(errorHandler);

export { router as quoteRoutes };
