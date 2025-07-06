import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { authenticate } from '../../auth/middleware';
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

// Global middleware
router.use(authenticate);
router.use(requireTradieRole);
router.use(requestLogger);
router.use(generalJobRateLimit);

// Create job
router.post(
  '/',
  jobCreationRateLimit,
  createJobValidationRules(),
  validateCreateJob,
  auditLogger('create_job'),
  asyncErrorHandler(jobController.createJob as any)
);

// Get jobs with pagination
router.get(
  '/',
  validatePaginationParams,
  auditLogger('list_jobs'),
  asyncErrorHandler(jobController.getJobs as any)
);

// Get job summary
router.get(
  '/summary',
  auditLogger('get_job_summary'),
  asyncErrorHandler(jobController.getJobSummary as any)
);

// Get job statistics
router.get(
  '/statistics',
  auditLogger('get_job_statistics'),
  asyncErrorHandler(jobController.getJobStatistics as any)
);

// Get overdue jobs
router.get(
  '/overdue',
  auditLogger('get_overdue_jobs'),
  asyncErrorHandler(jobController.getOverdueJobs as any)
);

// Get upcoming jobs
router.get(
  '/upcoming',
  auditLogger('get_upcoming_jobs'),
  asyncErrorHandler(jobController.getUpcomingJobs as any)
);

// Get job by ID
router.get(
  '/:id',
  validateJobId,
  auditLogger('get_job'),
  asyncErrorHandler(jobController.getJobById as any)
);

// Update job
router.put(
  '/:id',
  validateJobId,
  jobUpdateRateLimit,
  updateJobValidationRules(),
  validateUpdateJob,
  auditLogger('update_job'),
  asyncErrorHandler(jobController.updateJob as any)
);

// Update job status
router.patch(
  '/:id/status',
  validateJobId,
  jobUpdateRateLimit,
  updateJobStatusValidationRules(),
  validateUpdateJobStatus,
  auditLogger('update_job_status'),
  asyncErrorHandler(jobController.updateJobStatus as any)
);

// Delete job
router.delete(
  '/:id',
  validateJobId,
  auditLogger('delete_job'),
  asyncErrorHandler(jobController.deleteJob as any)
);

// Add job materials
router.post(
  '/:id/materials',
  validateJobId,
  addMaterialValidationRules(),
  validateAddMaterial,
  auditLogger('add_job_materials'),
  asyncErrorHandler(jobController.addJobMaterials as any)
);

// Get job materials
router.get(
  '/:id/materials',
  validateJobId,
  auditLogger('get_job_materials'),
  asyncErrorHandler(jobController.getJobMaterials as any)
);

// Update job material
router.put(
  '/:id/materials/:materialId',
  validateJobId,
  validateMaterialId,
  updateMaterialValidationRules(),
  validateUpdateMaterial,
  auditLogger('update_job_material'),
  asyncErrorHandler(jobController.updateJobMaterial as any)
);

// Remove job material
router.delete(
  '/:id/materials/:materialId',
  validateJobId,
  validateMaterialId,
  auditLogger('remove_job_material'),
  asyncErrorHandler(jobController.removeJobMaterial as any)
);

// Add job attachment
router.post(
  '/:id/attachments',
  validateJobId,
  fileUploadRateLimit,
  uploadJobAttachment,
  handleUploadError,
  auditLogger('add_job_attachment'),
  asyncErrorHandler(jobController.addJobAttachment as any)
);

// Get job attachments
router.get(
  '/:id/attachments',
  validateJobId,
  auditLogger('get_job_attachments'),
  asyncErrorHandler(jobController.getJobAttachments as any)
);

// Remove job attachment
router.delete(
  '/:id/attachments/:attachmentId',
  validateJobId,
  validateAttachmentId,
  auditLogger('remove_job_attachment'),
  asyncErrorHandler(jobController.removeJobAttachment as any)
);

export default router;
