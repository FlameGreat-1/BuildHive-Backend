import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
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
  asyncErrorHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    return await jobController.createJob(req, res, next);
  })
);

// Get jobs with pagination
router.get(
  '/',
  validatePaginationParams,
  auditLogger('list_jobs'),
  asyncErrorHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    return await jobController.getJobs(req, res, next);
  })
);

// Get job summary
router.get(
  '/summary',
  auditLogger('get_job_summary'),
  asyncErrorHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    return await jobController.getJobSummary(req, res, next);
  })
);

// Get job statistics
router.get(
  '/statistics',
  auditLogger('get_job_statistics'),
  asyncErrorHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    return await jobController.getJobStatistics(req, res, next);
  })
);

// Get overdue jobs
router.get(
  '/overdue',
  auditLogger('get_overdue_jobs'),
  asyncErrorHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    return await jobController.getOverdueJobs(req, res, next);
  })
);

// Get upcoming jobs
router.get(
  '/upcoming',
  auditLogger('get_upcoming_jobs'),
  asyncErrorHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    return await jobController.getUpcomingJobs(req, res, next);
  })
);

// Get job by ID
router.get(
  '/:id',
  validateJobId,
  auditLogger('get_job'),
  asyncErrorHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    return await jobController.getJobById(req, res, next);
  })
);

// Update job
router.put(
  '/:id',
  validateJobId,
  jobUpdateRateLimit,
  updateJobValidationRules(),
  validateUpdateJob,
  auditLogger('update_job'),
  asyncErrorHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    return await jobController.updateJob(req, res, next);
  })
);

// Update job status
router.patch(
  '/:id/status',
  validateJobId,
  jobUpdateRateLimit,
  updateJobStatusValidationRules(),
  validateUpdateJobStatus,
  auditLogger('update_job_status'),
  asyncErrorHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    return await jobController.updateJobStatus(req, res, next);
  })
);

// Delete job
router.delete(
  '/:id',
  validateJobId,
  auditLogger('delete_job'),
  asyncErrorHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    return await jobController.deleteJob(req, res, next);
  })
);

// Add job materials
router.post(
  '/:id/materials',
  validateJobId,
  addMaterialValidationRules(),
  validateAddMaterial,
  auditLogger('add_job_materials'),
  asyncErrorHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    return await jobController.addJobMaterials(req, res, next);
  })
);

// Get job materials
router.get(
  '/:id/materials',
  validateJobId,
  auditLogger('get_job_materials'),
  asyncErrorHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    return await jobController.getJobMaterials(req, res, next);
  })
);

// Update job material
router.put(
  '/:id/materials/:materialId',
  validateJobId,
  validateMaterialId,
  updateMaterialValidationRules(),
  validateUpdateMaterial,
  auditLogger('update_job_material'),
  asyncErrorHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    return await jobController.updateJobMaterial(req, res, next);
  })
);

// Remove job material
router.delete(
  '/:id/materials/:materialId',
  validateJobId,
  validateMaterialId,
  auditLogger('remove_job_material'),
  asyncErrorHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    return await jobController.removeJobMaterial(req, res, next);
  })
);

// Add job attachment
router.post(
  '/:id/attachments',
  validateJobId,
  fileUploadRateLimit,
  uploadJobAttachment,
  handleUploadError,
  auditLogger('add_job_attachment'),
  asyncErrorHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    return await jobController.addJobAttachment(req, res, next);
  })
);

// Get job attachments
router.get(
  '/:id/attachments',
  validateJobId,
  auditLogger('get_job_attachments'),
  asyncErrorHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    return await jobController.getJobAttachments(req, res, next);
  })
);

// Remove job attachment
router.delete(
  '/:id/attachments/:attachmentId',
  validateJobId,
  validateAttachmentId,
  auditLogger('remove_job_attachment'),
  asyncErrorHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    return await jobController.removeJobAttachment(req, res, next);
  })
);

export default router;
