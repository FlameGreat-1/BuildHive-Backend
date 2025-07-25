import { Router } from 'express';
import {
  applicationController,
  createApplication,
  getApplication,
  getApplicationsByJob,
  getTradieApplications,
  searchApplications,
  updateApplication,
  updateApplicationStatus,
  withdrawApplication,
  getTradieApplicationHistory,
  getApplicationAnalytics,
  bulkUpdateApplicationStatus,
  getApplicationsByStatus,
  getApplicationMetrics
} from '../controllers';
import {
  validateApplicationCreation,
  validateApplicationUpdate,
  validateApplicationSearch,
  validateApplicationStatusUpdate,
  checkApplicationOwnership,
  checkApplicationWithdrawal,
  rateLimitApplicationCreation,
  rateLimitApplicationSearch,
  logApplicationActivity,
  validateTradieRole,
  validateClientRole,
  sanitizeApplicationData,
  validatePagination,
  validateApplicationFilters,
  checkDuplicateApplication,
  validateJobApplicationAccess,
  cacheApplicationData,
  trackApplicationViews,
  requireApplicationAccess,
  validateBulkApplicationOperations,
  validateWithdrawalData,
  checkApplicationLimit,
  handleApplicationErrors
} from '../middleware';
import { authenticate, authorize } from '../../shared/middleware';

const router = Router();

router.post(
  '/',
  authenticate,
  validateTradieRole,
  sanitizeApplicationData,
  validateApplicationCreation,
  checkDuplicateApplication,
  checkApplicationLimit,
  rateLimitApplicationCreation,
  logApplicationActivity('application_creation'),
  createApplication
);

router.get(
  '/search',
  authenticate,
  validateApplicationSearch,
  validateApplicationFilters,
  validatePagination,
  rateLimitApplicationSearch,
  cacheApplicationData(300),
  logApplicationActivity('application_search'),
  searchApplications
);

router.get(
  '/tradie/history',
  authenticate,
  validateTradieRole,
  cacheApplicationData(300),
  logApplicationActivity('tradie_application_history'),
  getTradieApplicationHistory
);

router.get(
  '/tradie/applications',
  authenticate,
  validateTradieRole,
  validatePagination,
  logApplicationActivity('tradie_applications'),
  getTradieApplications
);

router.get(
  '/analytics',
  authenticate,
  validatePagination,
  cacheApplicationData(600),
  logApplicationActivity('application_analytics'),
  getApplicationAnalytics
);

router.get(
  '/status/:status',
  authenticate,
  validatePagination,
  cacheApplicationData(180),
  logApplicationActivity('applications_by_status'),
  getApplicationsByStatus
);

router.post(
  '/bulk/status',
  authenticate,
  validateClientRole,
  validateBulkApplicationOperations,
  logApplicationActivity('bulk_application_status_update'),
  bulkUpdateApplicationStatus
);

router.get(
  '/job/:jobId',
  authenticate,
  validateClientRole,
  validateJobApplicationAccess,
  validatePagination,
  logApplicationActivity('job_applications'),
  getApplicationsByJob
);

router.get(
  '/:applicationId',
  authenticate,
  requireApplicationAccess('read'),
  trackApplicationViews,
  cacheApplicationData(300),
  logApplicationActivity('application_view'),
  getApplication
);

router.put(
  '/:applicationId',
  authenticate,
  validateTradieRole,
  checkApplicationOwnership,
  sanitizeApplicationData,
  validateApplicationUpdate,
  logApplicationActivity('application_update'),
  updateApplication
);

router.patch(
  '/:applicationId/status',
  authenticate,
  validateClientRole,
  sanitizeApplicationData,
  validateApplicationStatusUpdate,
  logApplicationActivity('application_status_update'),
  updateApplicationStatus
);

router.post(
  '/:applicationId/withdraw',
  authenticate,
  validateTradieRole,
  checkApplicationOwnership,
  checkApplicationWithdrawal,
  validateWithdrawalData,
  logApplicationActivity('application_withdrawal'),
  withdrawApplication
);

router.get(
  '/:applicationId/metrics',
  authenticate,
  requireApplicationAccess('read'),
  cacheApplicationData(300),
  logApplicationActivity('application_metrics'),
  getApplicationMetrics
);

router.use(handleApplicationErrors);

export default router;
  
