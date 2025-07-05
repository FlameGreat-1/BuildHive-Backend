import { Router, Request, Response, NextFunction } from 'express';
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
  asyncErrorHandler(async (req: Request, res: Response, next: NextFunction) => {
    return await jobController.getJobAttachments(req, res, next);
  })
);

// Get specific attachment by ID
router.get(
  '/jobs/:jobId/attachments/:attachmentId',
  validateJobId,
  validateAttachmentId,
  auditLogger('get_attachment'),
  asyncErrorHandler(async (req: Request, res: Response, next: NextFunction) => {
    try {
      return await jobController.getJobAttachmentById(req, res, next);
    } catch (error) {
      return res.status(404).json({ 
        success: false, 
        message: 'Attachment not found',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

// Delete attachment
router.delete(
  '/jobs/:jobId/attachments/:attachmentId',
  validateJobId,
  validateAttachmentId,
  auditLogger('delete_attachment'),
  asyncErrorHandler(async (req: Request, res: Response, next: NextFunction) => {
    return await jobController.removeJobAttachment(req, res, next);
  })
);

export default router;
