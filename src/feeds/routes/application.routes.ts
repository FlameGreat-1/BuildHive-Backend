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
  trackApplicationViews,
  requireApplicationAccess,
  validateBulkOperations,
  handleApplicationErrors
} from '../middleware';
import { authenticate } from '../../auth/middleware/auth.middleware';

const router = Router();

router.post(
  '/',
  authenticate,
  validateTradieRole,
  sanitizeApplicationData,
  validateApplicationCreation,
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
  logApplicationActivity('application_search'),
  searchApplications
);

router.get(
  '/tradie/history',
  authenticate,
  validateTradieRole,
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
  logApplicationActivity('application_analytics'),
  getApplicationAnalytics
);

router.get(
  '/status/:status',
  authenticate,
  validatePagination,
  logApplicationActivity('applications_by_status'),
  getApplicationsByStatus
);

router.post(
  '/bulk/status',
  authenticate,
  validateClientRole,
  validateBulkOperations,
  logApplicationActivity('bulk_application_status_update'),
  bulkUpdateApplicationStatus
);

router.get(
  '/job/:jobId',
  authenticate,
  validateClientRole,
  validatePagination,
  logApplicationActivity('job_applications'),
  getApplicationsByJob
);

router.get(
  '/job/:jobId/analytics',
  authenticate,
  validateClientRole,
  logApplicationActivity('job_application_analytics'),
  getApplicationAnalytics
);

router.get(
  '/:applicationId',
  authenticate,
  requireApplicationAccess('read'),
  trackApplicationViews,
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
  logApplicationActivity('application_withdrawal'),
  withdrawApplication
);

router.get(
  '/:applicationId/metrics',
  authenticate,
  requireApplicationAccess('read'),
  logApplicationActivity('application_metrics'),
  getApplicationMetrics
);

router.use(handleApplicationErrors);

export default router;
