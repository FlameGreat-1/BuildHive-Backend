import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { authenticate } from '../../auth/middleware'; 
import { jobController } from '../controllers';
import {
  requireTradieRole,
  validateJobId,
  validateAttachmentId,
  generalJobRateLimit,
  requestLogger,
  auditLogger,
  asyncErrorHandler
} from '../middleware';

const router = Router();

// Global middleware
router.use(authenticate);
router.use(requireTradieRole);
router.use(requestLogger);
router.use(generalJobRateLimit);

// Get all attachments for a job
router.get(
  '/jobs/:jobId/attachments',
  validateJobId,
  auditLogger('get_attachments_by_job'),
  asyncErrorHandler(jobController.getJobAttachments as any)
);

// Delete attachment
router.delete(
  '/jobs/:jobId/attachments/:attachmentId',
  validateJobId,
  validateAttachmentId,
  auditLogger('delete_attachment'),
  asyncErrorHandler(jobController.removeJobAttachment as any)
);

export default router;
