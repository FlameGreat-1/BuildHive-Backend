import { Router } from 'express';
import { jobController } from '../controllers';
import {
  requireTradieRole,
  uploadJobAttachment,
  uploadMultipleJobAttachments,
  handleUploadError,
  validateJobId,
  validateMaterialId,
  validateAttachmentId,
  validatePaginationParams,
  jobCreationRateLimit,
  fileUploadRateLimit,
  jobUpdateRateLimit,
  generalJobRateLimit,
  requestLogger,
  auditLogger,
  asyncErrorHandler
} from '../middleware';
import {
  createJobValidationRules,
  validateCreateJob,
  updateJobValidationRules,
  validateUpdateJob,
  updateJobStatusValidationRules,
  validateUpdateJobStatus,
  addMaterialValidationRules,
  validateAddMaterial,
  updateMaterialValidationRules,
  validateUpdateMaterial
} from '../validators';

const router = Router();

router.use(requireTradieRole);
router.use(requestLogger);
router.use(generalJobRateLimit);

router.post(
  '/',
  jobCreationRateLimit,
  createJobValidationRules(),
  validateCreateJob,
  auditLogger('create_job'),
  asyncErrorHandler(jobController.createJob.bind(jobController))
);

router.get(
  '/',
  validatePaginationParams,
  auditLogger('list_jobs'),
  asyncErrorHandler(jobController.getJobs.bind(jobController))
);

router.get(
  '/summary',
  auditLogger('get_job_summary'),
  asyncErrorHandler(jobController.getJobSummary.bind(jobController))
);

router.get(
  '/statistics',
  auditLogger('get_job_statistics'),
  asyncErrorHandler(jobController.getJobStatistics.bind(jobController))
);

router.get(
  '/overdue',
  auditLogger('get_overdue_jobs'),
  asyncErrorHandler(jobController.getOverdueJobs.bind(jobController))
);

router.get(
  '/upcoming',
  auditLogger('get_upcoming_jobs'),
  asyncErrorHandler(jobController.getUpcomingJobs.bind(jobController))
);

router.get(
  '/:id',
  validateJobId,
  auditLogger('get_job'),
  asyncErrorHandler(jobController.getJobById.bind(jobController))
);

router.put(
  '/:id',
  validateJobId,
  jobUpdateRateLimit,
  updateJobValidationRules(),
  validateUpdateJob,
  auditLogger('update_job'),
  asyncErrorHandler(jobController.updateJob.bind(jobController))
);

router.patch(
  '/:id/status',
  validateJobId,
  jobUpdateRateLimit,
  updateJobStatusValidationRules(),
  validateUpdateJobStatus,
  auditLogger('update_job_status'),
  asyncErrorHandler(jobController.updateJobStatus.bind(jobController))
);

router.delete(
  '/:id',
  validateJobId,
  auditLogger('delete_job'),
  asyncErrorHandler(jobController.deleteJob.bind(jobController))
);

router.post(
  '/:id/materials',
  validateJobId,
  addMaterialValidationRules(),
  validateAddMaterial,
  auditLogger('add_job_materials'),
  asyncErrorHandler(jobController.addJobMaterials.bind(jobController))
);

router.get(
  '/:id/materials',
  validateJobId,
  auditLogger('get_job_materials'),
  asyncErrorHandler(jobController.getJobMaterials.bind(jobController))
);

router.put(
  '/:id/materials/:materialId',
  validateJobId,
  validateMaterialId,
  updateMaterialValidationRules(),
  validateUpdateMaterial,
  auditLogger('update_job_material'),
  asyncErrorHandler(jobController.updateJobMaterial.bind(jobController))
);

router.delete(
  '/:id/materials/:materialId',
  validateJobId,
  validateMaterialId,
  auditLogger('remove_job_material'),
  asyncErrorHandler(jobController.removeJobMaterial.bind(jobController))
);

router.post(
  '/:id/attachments',
  validateJobId,
  fileUploadRateLimit,
  uploadJobAttachment,
  handleUploadError,
  auditLogger('add_job_attachment'),
  asyncErrorHandler(jobController.addJobAttachment.bind(jobController))
);

router.post(
  '/:id/attachments/multiple',
  validateJobId,
  fileUploadRateLimit,
  uploadMultipleJobAttachments,
  handleUploadError,
  auditLogger('add_multiple_job_attachments'),
  asyncErrorHandler(jobController.addJobAttachment.bind(jobController))
);

router.get(
  '/:id/attachments',
  validateJobId,
  auditLogger('get_job_attachments'),
  asyncErrorHandler(jobController.getJobAttachments.bind(jobController))
);

router.delete(
  '/:id/attachments/:attachmentId',
  validateJobId,
  validateAttachmentId,
  auditLogger('remove_job_attachment'),
  asyncErrorHandler(jobController.removeJobAttachment.bind(jobController))
);

export default router;
