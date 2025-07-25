import { Router } from 'express';
import {
  marketplaceController,
  createMarketplaceJob,
  getMarketplaceJob,
  searchMarketplaceJobs,
  updateMarketplaceJob,
  updateJobStatus,
  deleteMarketplaceJob,
  getClientJobs,
  getMarketplaceStats,
  getJobCreditCost,
  getRecommendedJobs,
  processExpiredJobs,
  bulkUpdateJobStatus,
  getJobApplications,
  getJobAnalytics
} from '../controllers';
import {
  validateJobCreation,
  validateJobUpdate,
  validateJobSearch,
  validateJobStatusUpdate,
  checkJobOwnership,
  checkJobAvailability,
  rateLimitJobCreation,
  rateLimitJobSearch,
  logJobActivity,
  validateClientRole,
  validateTradieRole,
  sanitizeJobData,
  validatePagination,
  checkJobDeletion,
  validateJobFilters,
  cacheJobData,
  trackJobViews,
  validateJobExpiry,
  requireJobAccess,
  validateBulkOperations,
  handleJobErrors
} from '../middleware';
import { authenticate, authorize } from '../../shared/middleware';

const router = Router();

router.post(
  '/',
  sanitizeJobData,
  validateJobCreation,
  rateLimitJobCreation,
  logJobActivity('job_creation'),
  createMarketplaceJob
);

router.post(
  '/authenticated',
  authenticate,
  validateClientRole,
  sanitizeJobData,
  validateJobCreation,
  rateLimitJobCreation,
  logJobActivity('authenticated_job_creation'),
  createMarketplaceJob
);

router.get(
  '/search',
  validateJobSearch,
  validateJobFilters,
  validatePagination,
  rateLimitJobSearch,
  cacheJobData(300),
  logJobActivity('job_search'),
  searchMarketplaceJobs
);

router.get(
  '/stats',
  authenticate,
  authorize(['admin']),
  cacheJobData(600),
  logJobActivity('marketplace_stats'),
  getMarketplaceStats
);

router.get(
  '/recommended',
  authenticate,
  validateTradieRole,
  validatePagination,
  cacheJobData(180),
  logJobActivity('recommended_jobs'),
  getRecommendedJobs
);

router.get(
  '/client/jobs',
  authenticate,
  validateClientRole,
  validatePagination,
  logJobActivity('client_jobs'),
  getClientJobs
);

router.post(
  '/process-expired',
  authenticate,
  authorize(['admin', 'system']),
  logJobActivity('process_expired_jobs'),
  processExpiredJobs
);

router.post(
  '/bulk/status',
  authenticate,
  validateClientRole,
  validateBulkOperations,
  logJobActivity('bulk_status_update'),
  bulkUpdateJobStatus
);

router.get(
  '/:jobId',
  trackJobViews,
  validateJobExpiry,
  cacheJobData(300),
  logJobActivity('job_view'),
  getMarketplaceJob
);

router.put(
  '/:jobId',
  authenticate,
  validateClientRole,
  checkJobOwnership,
  sanitizeJobData,
  validateJobUpdate,
  logJobActivity('job_update'),
  updateMarketplaceJob
);

router.patch(
  '/:jobId/status',
  authenticate,
  validateClientRole,
  checkJobOwnership,
  sanitizeJobData,
  validateJobStatusUpdate,
  logJobActivity('job_status_update'),
  updateJobStatus
);

router.delete(
  '/:jobId',
  authenticate,
  validateClientRole,
  checkJobOwnership,
  checkJobDeletion,
  logJobActivity('job_deletion'),
  deleteMarketplaceJob
);

router.get(
  '/:jobId/credit-cost',
  authenticate,
  validateTradieRole,
  checkJobAvailability,
  cacheJobData(600),
  logJobActivity('credit_cost_check'),
  getJobCreditCost
);

router.get(
  '/:jobId/applications',
  authenticate,
  validateClientRole,
  requireJobAccess('read'),
  validatePagination,
  logJobActivity('job_applications_view'),
  getJobApplications
);

router.get(
  '/:jobId/analytics',
  authenticate,
  validateClientRole,
  requireJobAccess('read'),
  cacheJobData(300),
  logJobActivity('job_analytics'),
  getJobAnalytics
);

router.use(handleJobErrors);

export default router;
