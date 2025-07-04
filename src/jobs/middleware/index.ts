export * from './auth.middleware';
export * from './upload.middleware';
export * from './validation.middleware';
export * from './rate-limit.middleware';
export * from './logging.middleware';
export * from './error.middleware';

export {
  requireJobOwnership,
  requireClientOwnership,
  requireTradieRole,
  requireEnterpriseRole
} from './auth.middleware';

export {
  uploadJobAttachment,
  uploadMultipleJobAttachments,
  handleUploadError
} from './upload.middleware';

export {
  handleValidationErrors,
  validateJobId,
  validateClientId,
  validateMaterialId,
  validateAttachmentId,
  validatePaginationParams
} from './validation.middleware';

export {
  jobCreationRateLimit,
  fileUploadRateLimit,
  jobUpdateRateLimit,
  generalJobRateLimit
} from './rate-limit.middleware';

export {
  requestLogger,
  auditLogger,
  sensitiveDataLogger
} from './logging.middleware';

export {
  jobErrorHandler,
  notFoundHandler,
  asyncErrorHandler
} from './error.middleware';
