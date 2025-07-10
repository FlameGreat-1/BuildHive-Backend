import { Router } from 'express';
import { WebhookController } from '../controllers';
import { 
  validateWebhookSignature,
  parseWebhookPayload,
  rateLimitWebhooks
} from '../middleware/webhook.middleware';
import {
  authenticateWebhookAdmin,
  authorizeWebhookAccess
} from '../middleware/payment-auth.middleware';

const router = Router();
const webhookController = new WebhookController();

// Stripe webhook endpoint - no authentication required, signature validation only
router.post(
  '/stripe',
  rateLimitWebhooks,
  parseWebhookPayload,
  validateWebhookSignature,
  webhookController.handleStripeWebhook.bind(webhookController)
);

// Admin endpoints for webhook management
router.post(
  '/retry/:eventId',
  authenticateWebhookAdmin,
  authorizeWebhookAccess,
  webhookController.retryWebhookEvent.bind(webhookController)
);

router.get(
  '/health',
  webhookController.getWebhookHealth.bind(webhookController)
);

router.get(
  '/validate',
  webhookController.validateWebhookEndpoint.bind(webhookController)
);

router.get(
  '/config',
  authenticateWebhookAdmin,
  authorizeWebhookAccess,
  webhookController.getWebhookConfiguration.bind(webhookController)
);

export { router as webhookRoutes };
