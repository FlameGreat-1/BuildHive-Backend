import { Router } from 'express';
import { 
  jobController, 
  clientController, 
  materialController, 
  attachmentController 
} from '../controllers';
import {
  requireJobOwnership,
  requireClientOwnership,
  requireTradieRole,
  uploadJobAttachment,
  uploadMultipleJobAttachments,
  handleUploadError,
  validateJobId,
  validateClientId,
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
  validateAddMaterial
} from '../validators';

const router = Router();

// Apply general middleware to all job routes
router.use(requireTradieRole);
router.use(requestLogger);
router.use(generalJobRateLimit);

// Job CRUD Operations
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
  '/:id',
  validateJobId,
  requireJobOwnership,
  auditLogger('get_job'),
  asyncErrorHandler(jobController.getJobById.bind(jobController))
);

router.put(
  '/:id',
  validateJobId,
  requireJobOwnership,
  jobUpdateRateLimit,
  updateJobValidationRules(),
  validateUpdateJob,
  auditLogger('update_job'),
  asyncErrorHandler(jobController.updateJob.bind(jobController))
);

router.patch(
  '/:id/status',
  validateJobId,
  requireJobOwnership,
  jobUpdateRateLimit,
  updateJobStatusValidationRules(),
  validateUpdateJobStatus,
  auditLogger('update_job_status'),
  asyncErrorHandler(jobController.updateJobStatus.bind(jobController))
);

router.delete(
  '/:id',
  validateJobId,
  requireJobOwnership,
  auditLogger('delete_job'),
  asyncErrorHandler(jobController.deleteJob.bind(jobController))
);

// Job Materials Routes
router.post(
  '/:id/materials',
  validateJobId,
  requireJobOwnership,
  addMaterialValidationRules(),
  validateAddMaterial,
  auditLogger('add_job_materials'),
  asyncErrorHandler(jobController.addJobMaterials.bind(jobController))
);

router.get(
  '/:id/materials',
  validateJobId,
  requireJobOwnership,
  auditLogger('get_job_materials'),
  asyncErrorHandler(jobController.getJobMaterials.bind(jobController))
);

router.put(
  '/:id/materials/:materialId',
  validateJobId,
  validateMaterialId,
  requireJobOwnership,
  auditLogger('update_job_material'),
  asyncErrorHandler(jobController.updateJobMaterial.bind(jobController))
);

router.delete(
  '/:id/materials/:materialId',
  validateJobId,
  validateMaterialId,
  requireJobOwnership,
  auditLogger('remove_job_material'),
  asyncErrorHandler(jobController.removeJobMaterial.bind(jobController))
);

// Job Attachments Routes
router.post(
  '/:id/attachments',
  validateJobId,
  requireJobOwnership,
  fileUploadRateLimit,
  uploadJobAttachment,
  handleUploadError,
  auditLogger('add_job_attachment'),
  asyncErrorHandler(jobController.addJobAttachment.bind(jobController))
);

router.post(
  '/:id/attachments/multiple',
  validateJobId,
  requireJobOwnership,
  fileUploadRateLimit,
  uploadMultipleJobAttachments,
  handleUploadError,
  auditLogger('add_multiple_job_attachments'),
  asyncErrorHandler(jobController.addJobAttachment.bind(jobController))
);

router.get(
  '/:id/attachments',
  validateJobId,
  requireJobOwnership,
  auditLogger('get_job_attachments'),
  asyncErrorHandler(jobController.getJobAttachments.bind(jobController))
);

router.delete(
  '/:id/attachments/:attachmentId',
  validateJobId,
  validateAttachmentId,
  requireJobOwnership,
  auditLogger('remove_job_attachment'),
  asyncErrorHandler(jobController.removeJobAttachment.bind(jobController))
);

export default router;
