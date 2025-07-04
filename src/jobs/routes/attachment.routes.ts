import { Router } from 'express';
import { attachmentController } from '../controllers';
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

// Apply general middleware to all attachment routes
router.use(requireTradieRole);
router.use(requestLogger);
router.use(generalJobRateLimit);

// Attachment Operations (nested under jobs)
router.get(
  '/jobs/:jobId/attachments',
  validateJobId,
  auditLogger('get_attachments_by_job'),
  asyncErrorHandler(attachmentController.getAttachmentsByJobId.bind(attachmentController))
);

router.get(
  '/jobs/:jobId/attachments/:id',
  validateJobId,
  validateAttachmentId,
  auditLogger('get_attachment'),
  asyncErrorHandler(attachmentController.getAttachmentById.bind(attachmentController))
);

router.delete(
  '/jobs/:jobId/attachments/:id',
  validateJobId,
  validateAttachmentId,
  auditLogger('delete_attachment'),
  asyncErrorHandler(attachmentController.deleteAttachment.bind(attachmentController))
);

export default router;
