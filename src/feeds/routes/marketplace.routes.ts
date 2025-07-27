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
  getMarketplaceAnalytics
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
import { authenticate } from '../../auth/middleware/auth.middleware';

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
  validateClientRole,
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
  validateClientRole,
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
  '/analytics',
  authenticate,
  validateClientRole,
  cacheJobData(600),
  logJobActivity('marketplace_analytics'),
  getMarketplaceAnalytics
);

router.use(handleJobErrors);

export default router;
