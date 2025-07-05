import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
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
router.use(requireTradieRole);
router.use(requestLogger);
router.use(generalJobRateLimit);

// Get all attachments for a job
router.get(
  '/jobs/:jobId/attachments',
  validateJobId,
  auditLogger('get_attachments_by_job'),
  asyncErrorHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    return await jobController.getJobAttachments(req, res, next);
  })
);

// Delete attachment
router.delete(
  '/jobs/:jobId/attachments/:attachmentId',
  validateJobId,
  validateAttachmentId,
  auditLogger('delete_attachment'),
  asyncErrorHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    return await jobController.removeJobAttachment(req, res, next);
  })
);

export default router;
