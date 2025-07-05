import { Router } from 'express';
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

router.use(requireTradieRole);
router.use(requestLogger);
router.use(generalJobRateLimit);

router.get(
  '/jobs/:jobId/attachments',
  validateJobId,
  auditLogger('get_attachments_by_job'),
  asyncErrorHandler(jobController.getJobAttachments.bind(jobController))
);

router.get(
  '/jobs/:jobId/attachments/:attachmentId',
  validateJobId,
  validateAttachmentId,
  auditLogger('get_attachment'),
  asyncErrorHandler(async (req, res, next) => {
    const attachments = await jobController.getJobAttachments(req, res, next);
    if (attachments && Array.isArray(attachments)) {
      const attachment = attachments.find(att => att.id === parseInt(req.params.attachmentId));
      if (attachment) {
        res.json({ success: true, data: attachment });
      } else {
        res.status(404).json({ success: false, message: 'Attachment not found' });
      }
    }
  })
);

router.delete(
  '/jobs/:jobId/attachments/:attachmentId',
  validateJobId,
  validateAttachmentId,
  auditLogger('delete_attachment'),
  asyncErrorHandler(jobController.removeJobAttachment.bind(jobController))
);

export default router;
